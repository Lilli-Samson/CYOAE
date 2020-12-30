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

interface Attribute_replacement {
	name: string;
	replacement(value: string): string;
	default_value?: string;
    html_escape?: boolean;
};

interface Tag_replacement {
    tag_name: string;
    attributes: Attribute_replacement[];
    intro?: string;
	outro?: string;
	generator?(tag: Tag): string;
}

const replacements: Tag_replacement[] = [
	{
		tag_name: "img",
		attributes:
			[
				{name: "url", replacement: url => ` src="${url}"`},
				{name: "alt", replacement: alt => ` alt="${escape_html(alt)}"`, default_value: "image"},
            ],
		intro: "<img",
		outro: "/>\n",
	},
	{
		tag_name: "code",
		attributes:
			[
				{name: "text", replacement: text => escape_html(text)},
            ],
		intro: "<a class=\"code\">",
		outro: "</a>\n",
	},
	{
		tag_name: "choice",
		attributes:
			[
				{name: "next", replacement: next => ` href="#${current_arc}/${next}">`},
                {name: "text", replacement: text => escape_html(text)},
                {name: "onselect", replacement: onselect => "", default_value: ""},
            ],
		intro: "<a class=\"choice\"",
		outro: "</a>\n",
	},
	{
        tag_name: "source",
        attributes: [],
        intro: '<hr>',
		generator: function(tag: Tag) {
            const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
            return `<a href="${`${current_url}story arcs/${current_arc}/${current_scene}.txt`}">Source</a><br>\n<p class="source">${escape_html(current_source)}</p>`;
        },
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
	value: string;
};

interface Tag {
	ctx: Parse_context;
	name: string;
	value: string;
	attributes: Attribute[];
};

function remove_escapes(text: string) {
    return text.replace(/\\(.)/g, '$1');
}

function html_comment(content: string) {
	return `<!-- ${content.replace(/-->/g, "~~>")} -->\n`;
}

function execute_tag(tag: Tag) {
    console.log(`Executing tag ${tag.name} with value "${tag.value}" and attributes\n${tag.attributes.reduce((curr, attribute) => `${curr}\n\t${attribute.name}="${attribute.value}"`, "")}`)
    function fail(text: string) {
		output(html_comment(text));
		console.log(text);
	};
    for (const replacement of replacements) {
        if (replacement.tag_name !== tag.name) {
            continue;
        }
        //Todo: check if there are no duplicate attributes
        if (tag.value !== "") {
			tag.attributes.push({name: replacement.attributes[0].name, value: tag.value});
        }
        let tag_replacement_text = replacement.intro || "";

		for (const attribute_replacement of replacement.attributes) {
            const attribute_value_pos = tag.attributes.findIndex((attribute) => attribute.name === attribute_replacement.name);
            let attribute_value = tag.attributes[attribute_value_pos];
			if (!attribute_value) {
                if (attribute_replacement.default_value !== undefined) {
                    attribute_value = {name: attribute_replacement.name, value: attribute_replacement.default_value};
                }
                else {
                    return fail(`Missing attribute "${attribute_replacement.name}" in tag "${tag.name}"`);
                }
            }
            tag_replacement_text += attribute_replacement.replacement(attribute_value.value);
			tag.attributes.splice(attribute_value_pos, 1);
		}
		if (replacement.generator) {
			tag_replacement_text += replacement.generator(tag);
		}
		tag_replacement_text += replacement.outro || "";
		output(tag_replacement_text);
		for (const leftover_attribute of tag.attributes) {
			fail(`Unknown attribute "${leftover_attribute.name}" in tag "${tag.name}"`);
		}
		return;
    }
    fail("Unknown tag " + tag.name);
}

class Listener extends cyoaeListener {
    constructor() {
        super();
    }
    exitText(ctx: Parse_context) {
        output(`<a class="text">${escape_html(remove_escapes(ctx.getText()))}</a>`);
    }
    enterTag(ctx: Parse_context) {
        //console.log(`Tag child count: ${ctx.getChildCount()}`);
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
            else {
                //console.log(`Skipping child of type "${typeof child}" with value "${child.getText()}"`);
            }
        }
        execute_tag(tag);
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

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/start`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        current_source = await get(`${current_scene}.txt`);
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