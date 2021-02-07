"use strict";

const antlr4 = require("antlr4/index");
const cyoaeLexer = require("./cyoaeLexer");
const cyoaeParser = require("./cyoaeParser");
let cyoaeListener = require("./cyoaeListener").cyoaeListener;

let current_arc = "";
let current_scene = "";
let current_source = "";

function output(text: string) {
    document.body.innerHTML += text;
}

function get_executor(text: string) {
    console.log(`Tag to execute: ${text}`);
    return escape_html(text);
}

interface Attribute_replacement {
	name: string;
	replacement(value: string, tag: Tag): string;
	default_value?: string;
    html_escape?: boolean;
}

interface Tag_replacement {
    tag_name: string;
    intro?: string;
    replacements: Attribute_replacement[] | ((tag: Tag) => string);
    outro?: string;
}

function get_attribute_value(attribute_name: string, tag: Tag) {
    const attribute = tag.attributes.find(attribute => attribute.name === attribute_name);
    if (!attribute) {
        throw `Tried to obtain value "${attribute_name}" from tag "${tag.name}", but no such attribute exists. Valid attributes: [${tag.attributes.reduce((curr, attribute) => `${curr} ${attribute.name}`, "")} ]`;
    }
    return typeof attribute.value === "string" ? attribute.value : execute_tag(attribute.value);
}

let g = new Map<string, string | number>(); //storage for ingame variables
(window as any).g = g; //make accessible to html

function evaluate_variable(variable: string) : string {
    const value = g.get(variable);
    if (typeof value === "undefined") {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    return `${value}`;
}

let choice_available = new Map<string, boolean>(); //for [choice next=foo], choice_available.get("foo") tells whether the file foo.txt exists

function process_expression(expr: string) {
    //TODO: Replace this with a proper parser or maybe just a lexer at some point
    //TODO: Ensure parenthesis and quote balance
    return expr.replace(/(?<!["\w])[_a-zA-Z]\w*/g, 'g.get("$0")');
}

const replacements: Tag_replacement[] = [
	{ //img
		tag_name: "img",
		intro: "<img",
		replacements:
			[
				{name: "url", replacement: url => ` src="${url}"`},
				{name: "alt", replacement: alt => ` alt="${escape_html(alt)}"`, default_value: " alt='image'"},
            ],
		outro: "/>\n",
	},
	{ //code
		tag_name: "code",
		intro: "<a class='code'>",
		replacements:
			[
				{name: "text", replacement: text => escape_html(text)},
            ],
		outro: "</a>\n",
	},
	{ //choice
		tag_name: "choice",
        intro: "<a",
		replacements:
			[
				{name: "next", replacement: next => choice_available.get(`${current_arc}/${next}`) ? ` class='choice' href="#${current_arc}/${next}"` : ` class='dead_choice'`},
                {name: "onclick", replacement: (onclick, tag) => onclick && choice_available.get(`${current_arc}/${get_attribute_value("next", tag)}`) ? ` onclick="${onclick}"` : "", default_value: ""},
                {name: "text", replacement: text => '>' + escape_html(text)},
            ],
        outro: "</a>\n",
	},
	{ //source
        tag_name: "source",
        intro: '<hr>',
		replacements: function(tag: Tag) {
            const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
            return `<a href="${`${current_url}story arcs/${current_arc}/${current_scene}.txt`}">Source</a><br>\n<p class="source">${escape_html(current_source)}</p>`;
        },
    },
    { //exec
        tag_name: "exec",
        replacements: function(tag: Tag) {
            let result = "";
            for (const attribute of tag.attributes) {
                const code = get_attribute_value(attribute.name, tag);
                //TODO: Error handling
                result += `g.set('${attribute.name}', ${process_expression(code)});`;
            }
            return (result + "return true").replace(/"/g, "&quot;");
        },
    },
    { //print
        tag_name: "print",
        replacements: 
        [
            {name: "text", replacement: text => evaluate_variable(text)},
        ],
    },
];

interface Parse_context {
    getText (): string;
    invokingState: number;
    ruleIndex: number;
    //children: ?;
    //start: ?;
    //stop: ?;
    //exception: ?;
    //parser: ?;
    constructor(parser: any, parent: any, invokingState: any): Parse_context;
    tag_name(): string;
    enterRule(listener: any): void;
    exitRule(listener: any): void;
    copyFrom(ctx: Parse_context): void;
    //addChild: ?;
    //removeLastChild: ?;
    //addTokenNode: ?;
    //addErrorNode: ?;
    getChild(i: number, type?: string): Parse_context | null;
    //getToken: ?;
    //getTokens: ?;
    //getTypedRuleContext: ?;
    //getTypedRuleContexts: ?;
    getChildCount(): number;
    //getSourceInterval: ?;
    depth(): number;
    isEmpty(): boolean;
    getRuleContext(): Parse_context;
    getPayload(): Parse_context;
    getText(): string;
    //getAltNumber: ?;
    //setAltNumber: ?;
    //accept: ?;
    //toStringTree: ?;
    //toString: ?;
    text: string;
}

interface Attribute {
	name: string;
	value: string | Tag;
}

interface Tag {
	ctx: Parse_context;
	name: string;
	value: string;
	attributes: Attribute[];
}

function remove_escapes(text: string) {
    return text.replace(/\\(.)/g, '$1');
}

function html_comment(content: string) {
	return `<!-- ${content.replace(/-->/g, "~~>")} -->\n`;
}

function execute_tag(tag: Tag) {
    //console.log(`Executing tag ${tag.name} with value "${tag.value}" and attributes [${tag.attributes.reduce((curr, attribute) => `${curr}\t${attribute.name}="${attribute.value}"\n`, "\n")}]\n`)
    function fail(text: string) {
		console.log(text);
        return html_comment(text);
	};
    for (const replacement of replacements) {
        if (replacement.tag_name !== tag.name) {
            continue;
        }
        //Todo: check if there are no duplicate attributes

        let result = replacement.intro || "";
        if (typeof replacement.replacements === "function") {
            result += replacement.replacements(tag);
        }
        else {
            if (tag.value !== "") {
                tag.attributes.push({name: replacement.replacements[0].name, value: tag.value});
            }
    
            const attributes = [...tag.attributes]; //making copy so that removing attributes doesn't affect replacement functions
            for (const attribute_replacement of replacement.replacements) {
                const attribute_value_pos = attributes.findIndex((attribute) => attribute.name === attribute_replacement.name);
                let attribute_value = attributes[attribute_value_pos];
                if (!attribute_value) {
                    if (attribute_replacement.default_value !== undefined) {
                        attribute_value = {name: attribute_replacement.name, value: attribute_replacement.default_value};
                    }
                    else {
                        return fail(`Missing attribute "${attribute_replacement.name}" in tag "${tag.name}"`);
                    }
                }
                if (typeof attribute_value.value === "string") {
                    result += attribute_replacement.replacement(attribute_value.value, tag);
                }
                else {
                    result += attribute_replacement.replacement(execute_tag(attribute_value.value), tag);
                }
                if (attribute_value_pos !== -1) {
                    attributes.splice(attribute_value_pos, 1);
                }
            }
            for (const leftover_attribute of attributes) {
                return fail(`Unknown attribute "${leftover_attribute.name}" in tag "${tag.name}"`);
            }
        }
		result += replacement.outro || "";
		return result;
    }
    return fail("Unknown tag " + tag.name);
}

class Listener extends cyoaeListener {
    constructor() {
        super();
    }
    exitText(ctx: Parse_context) {
        output(`<a class="text">${escape_html(remove_escapes(ctx.getText()))}</a>`);
    }
    enterTag(ctx: Parse_context) {
        if (ctx.depth() !== 2) {
            //don't listen to non-toplevel tags, those get evaluated later
            //console.log(`Skipping tag ${ctx.getText()}`)
            return;
        }

        assert(ctx instanceof cyoaeParser.cyoaeParser.TagContext, "Passed non-tag to tak parser");

        function extract_tag(ctx: Parse_context) {
            let tag: Tag = {
                ctx: ctx,
                name: "",
                value: "",
                attributes: []
            };
            for (let i = 0; i < ctx.getChildCount(); i++) {
                const child = ctx.getChild(i);
                //console.log(`Tag child ${i}`);
                if (child === null) {
                    //console.log(`Got premature null child`);
                    continue;
                }
                else if (child instanceof cyoaeParser.cyoaeParser.Tag_nameContext) {
                    //console.log(`Got a tag name "${child.getText()}"`);
                    tag.name = child.getText();
                }
                else if (child instanceof cyoaeParser.cyoaeParser.AttributeContext) {
                    //console.log(`Got a tag attribute name "${child.getText()}"`);
                    tag.attributes.push({name: child.getText(), value: ""});
                }
                else if (child instanceof cyoaeParser.cyoaeParser.ValueContext) {
                    if (tag.attributes.length === 0) {
                        //console.log(`Got a tag value "${child.getText()}"`);
                        tag.value = remove_escapes(child.getText());
                    } else {
                        //console.log(`Got a tag attribute value "${child.getText()}"`);
                        tag.attributes[tag.attributes.length - 1].value = remove_escapes(child.getText());
                    }
                }
                else if (child instanceof cyoaeParser.cyoaeParser.TagContext) {
                    //console.log(`Got a tag attribute of type tag`);
                    tag.attributes[tag.attributes.length - 1].value = extract_tag(child);
                }
                else {
                    //console.log(`Skipping child of type "${typeof child}" with value "${child.getText()}"`);
                }
            }
            return tag;
        }
        output(execute_tag(extract_tag(ctx)));
    }
}

function parse_source_text(data: string, filename: string) {
    console.log(`Starting parsing source text ${filename}`);
    const input = new antlr4.InputStream(data);
    const lexer = new cyoaeLexer.cyoaeLexer(input);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new cyoaeParser.cyoaeParser(tokens);
    const tree = parser.start();
    const listener = new(Listener as any)();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(listener, tree);
}

async function update_choice_availability(code: string) {
    const debug = false;
    for (const scene of code.match(/(?<=next=)\w+/g) || []) {
        const arc_scene = `${current_arc}/${scene}`;
        debug && console.log(`Checking availabiliy for page ${arc_scene}`);
        if (choice_available.get(scene) === undefined) {
            try {
                await get(`${scene}.txt`);
                choice_available.set(arc_scene, true);
                debug && console.log(`Source for page ${arc_scene} is available`);
            }
            catch (_) {
                choice_available.set(arc_scene, false);
                debug && console.log(`Source for page ${arc_scene} is not available because ${_}`);
            }
        }
        else {
            debug && console.log(`But we already know that page ${arc_scene} is ${choice_available.get(arc_scene) ? "available" : "unavailable"}`);
        }
    }
}

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/variables`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        current_source = await get(`${current_scene}.txt`);
        await update_choice_availability(current_source);
        document.body.innerHTML = "";
        parse_source_text(current_source, `${current_scene}.txt`);
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}

async function url_hash_change () {
    const [, arc, scene] = window.location.hash.match(/#([^\/]*)\/(.*)/) || [];
    if (arc && scene) {
        current_arc = arc;
        current_scene = scene;
        await update_current_scene();
    }
}

window.onhashchange = url_hash_change;

// escapes HTML tags
function escape_html(str: string) {
    let element = document.createElement('p');
    element.innerText = str;
    return element.innerHTML;
}

// downloads a local resource given its path/filename
async function get(url: string) {
    const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
    const filepath = `${current_url}story arcs/${current_arc}/${url}`;
    try {
        const request = await fetch(filepath);
        if (request.ok) {
            return await request.text();
        }
        throw request.statusText;
    }
    catch (err) {
        throw `Failed loading resource ${filepath}: ${err}`;
    }
}

function display_error_document(error: string) {
    document.body.innerHTML = escape_html(`Error: ${error}`);
}

function assert(predicate: any, explanation: string = "") {
    if (!predicate) {
        if (explanation) {
            throw `Assertion fail: ${explanation}`;
        }
        throw `Assertion fail`;
    }
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        await play_arc("intro");
        await url_hash_change();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();