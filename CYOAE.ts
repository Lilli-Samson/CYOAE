"use strict";

import * as antlr4ts from 'antlr4ts';
import { cyoaeLexer } from './cyoaeLexer';
import * as cyoaeParser from './cyoaeParser';
import { cyoaeListener } from './cyoaeListener';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker'

let current_arc = "";
let current_scene = "";
let current_source = "";

class ParserErrorListener implements antlr4ts.ANTLRErrorListener<antlr4ts.Token> {
    syntaxError(recognizer: antlr4ts.Recognizer<antlr4ts.Token, any>, offendingSymbol: antlr4ts.Token | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {

    }
}

/*
ParserErrorListener.prototype.syntaxError = function(recognizer: any, offendingSymbol: any, line: number, column: number, msg: string, e: any) {
    console.log(`Syntax error in line ${line}:${column}: ${msg}`);
    console.log(`Details: recognizer: ${recognizer}, offendingSymbol: ${offendingSymbol}, e: ${e}`);
};

ParserErrorListener.prototype.reportAmbiguity = function(recognizer: any, dfa: any, startIndex: number, stopIndex: number, exact: any, ambigAlts: any, configs: any) {
    console.log(`Ambiguity error`);
};

ParserErrorListener.prototype.reportAttemptingFullContext = function(recognizer: any, dfa: any, startIndex: number, stopIndex: number, conflictingAlts: any, configs: any) {
    console.log(`Attempting full context`);
};

ParserErrorListener.prototype.reportContextSensitivity = function(recognizer: any, dfa: any, startIndex: number, stopIndex: number, prediction: any, configs: any) {
    console.log(`Context sensitivity detected`);
};
*/

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
    return expr.replace(/((?<!["\w])[_a-zA-Z]\w*)/g, 'g.get("$1")');
}

function strip_script_tag(expr: string) { //turns "<script>code</script>" into "code"
    return expr.replace(/<script>([^<]*)<\/script>/, "$0");
}

function evaluate(code: string) { //evaluates a string that may contain variables and expressions
    //TODO
    return code;
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
                {name: "onclick", replacement: (onclick, tag) => onclick && choice_available.get(`${current_arc}/${get_attribute_value("next", tag)}`) ?
                    ` onclick="${onclick.replace(/"/g, "&quot;")};return true"` : "", default_value: ""},
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
            for (const attribute of tag.attributes) {
                const code = get_attribute_value(attribute.name, tag);
                //TODO: Error handling
                g.set(attribute.name, evaluate(code));
            }
            return "";
        },
    },
    { //print
        tag_name: "print",
        replacements: 
        [
            {name: "variable", replacement: text => evaluate_variable(text)},
        ],
    },
];

interface Attribute {
	name: string;
	value: string | Tag;
}

interface Tag {
	ctx: cyoaeParser.Token_tagContext;
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

class Listener implements cyoaeListener {
    debug = false;
    exitToken_text(ctx: cyoaeParser.Token_textContext) {
        output(`<a class="text">${escape_html(remove_escapes(ctx.text))}</a>`);
    }
    enterToken_tag(ctx: cyoaeParser.Token_tagContext) {
        if (ctx.depth() !== 2) {
            //don't listen to non-toplevel tags, those get evaluated later
            this.debug && console.log(`Skipping tag ${ctx.text}`)
            return;
        }
        const debug = this.debug;
        function extract_tag(ctx: cyoaeParser.Token_tagContext) {
            let tag: Tag = {
                ctx: ctx,
                name: "",
                value: "",
                attributes: []
            };
            for (let i = 0; i < ctx.childCount; i++) {
                const child = ctx.getChild(i);
                debug && console.log(`Tag child ${i}`);
                if (child === null) {
                    debug && console.log(`Got premature null child`);
                    continue;
                }
                else if (child instanceof cyoaeParser.Token_tag_nameContext) {
                    debug && console.log(`Got a tag name "${child.text}"`);
                    tag.name = child.text;
                }
                else if (child instanceof cyoaeParser.Token_attributeContext) {
                    debug && console.log(`Got a tag attribute name "${child.text}"`);
                    tag.attributes.push({name: child.text, value: ""});
                }
                else if (child instanceof cyoaeParser.Token_valueContext) {
                    if (tag.attributes.length === 0) {
                        debug && console.log(`Got a tag value "${child.text}"`);
                        tag.value = remove_escapes(child.text);
                    } else {
                        debug && console.log(`Got a tag attribute value "${child.text}"`);
                        tag.attributes[tag.attributes.length - 1].value = remove_escapes(child.text);
                    }
                }
                else if (child instanceof cyoaeParser.Token_tagContext) {
                    debug && console.log(`Got a tag attribute of type tag`);
                    tag.attributes[tag.attributes.length - 1].value = extract_tag(child);
                }
                else {
                    debug && console.log(`Skipping child of type "${typeof child}" with value "${child.text}"`);
                }
            }
            return tag;
        }
        output(execute_tag(extract_tag(ctx)));
    }
}

function parse_source_text(data: string, filename: string) {
    console.log(`Starting parsing source text ${filename}`);
    const input = antlr4ts.CharStreams.fromString(data, filename);
    const lexer = new cyoaeLexer(input);
    const tokens = new antlr4ts.CommonTokenStream(lexer);
    const parser = new cyoaeParser.cyoaeParser(tokens);

    //TODO: Add error listeners
    lexer.removeErrorListeners();
    parser.removeErrorListeners();
    //lexer.addErrorListener(error_listener);
    parser.addErrorListener(new ParserErrorListener);
    
    const tree = parser.token_start();
    const listener = new(Listener as any)();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
}

async function update_choice_availability(code: string) {
    const debug = false;
    for (const scene of code.match(/(?<=next=)\w+/g) || []) {
        const arc_scene = `${current_arc}/${scene}`;
        debug && console.log(`Checking availabiliy for page ${arc_scene}`);
        if (choice_available.get(arc_scene) === undefined) {
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