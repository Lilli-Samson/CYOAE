"use strict";

import * as antlr4ts from 'antlr4ts';
import { cyoaeLexer } from './cyoaeLexer';
import * as cyoaeParser from './cyoaeParser';

let current_arc = "";
let current_scene = "";
let current_source = "";

class ParserErrorListener implements antlr4ts.ANTLRErrorListener<antlr4ts.Token> {
    syntaxError(recognizer: antlr4ts.Recognizer<antlr4ts.Token, any>, offendingSymbol: antlr4ts.Token | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {
        console.error(`Syntax error: In line ${line}:${charPositionInLine}: ${msg}`);
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

function get_executor(text: string) {
    console.log(`Tag to execute: ${text}`);
    return escape_html(text);
}

class Tag_result{
    static from_plaintext(text: string) {
        return new Tag_result(undefined, "", text);
    }
    static from_html(text: string) {
        return new Tag_result(undefined, text, "");
    }
    static from_ctx(ctx: cyoaeParser.Rich_text_Context) { //evaluating contexts can have side-effects, so it must be done exactly once iff necessary
        return new Tag_result(ctx, "", "");
    }
    get plaintext() {
        if (this.is_plaintext_available) {
            return this.current_plaintext;
        }
        throw "Plaintext unavailable";
    }
    get html() {
        this.expand_ctx();
        return this.current_html + Tag_result.plain_to_html(this.current_plaintext);
    }
    get is_plaintext_available() {
        this.expand_ctx();
        return this.current_html.length === 0;
    }
    get current_value() {
        if (this.ctx) {
            return this.ctx.text;
        }
        if (this.current_html) {
            return this.html;
        }
        return this.plaintext;
    }
    append(other: Tag_result) {
        if (other.is_plaintext_available) {
            return this.append_plaintext(other.plaintext);
        }
        else {
            return this.append_html(other.html);
        }
    }
    append_plaintext(text: string) {
        if (text.length === 0) {
            return this;
        }
        this.expand_ctx();
        return new Tag_result(undefined, this.current_html, this.current_plaintext + text);
    }
    append_html(text: string) {
        if (text.length === 0) {
            return this;
        }
        return new Tag_result(undefined, this.html + text, "");
    }
    private readonly ctx?: cyoaeParser.Rich_text_Context;
    private readonly current_html: string;
    private readonly current_plaintext: string;
    private expand_ctx() {
        if (this.ctx) {
            const other = evaluate_richtext(this.ctx);
            (this.ctx as cyoaeParser.Rich_text_Context | undefined) = undefined;
            (this.current_plaintext as string) = other.current_plaintext;
            (this.current_html as string) = other.current_html;
        }
    }
    private static plain_to_html(text: string) {
        if (text.length === 0) {
            return "";
        }
        return `<a class="plaintext">${escape_html(text)}</a>`;
    }
    private constructor(ctx: cyoaeParser.Rich_text_Context | undefined, html: string, plaintext: string) {
        this.ctx = ctx;
        this.current_plaintext = plaintext;
        this.current_html = html;
    }
}

interface Attribute_replacement {
	name: string;
	replacement(value: Tag_result, tag: Tag): Tag_result;
	default_value?: Tag_result;
}

interface Tag_replacement {
    readonly tag_name: string;
    readonly intro?: Tag_result;
    readonly replacements: Attribute_replacement[] | ((tag: Tag) => Tag_result);
    readonly outro?: Tag_result;
}

interface Attribute {
	name: string;
	readonly value: Tag_result;
}

interface Tag {
	ctx: cyoaeParser.Tag_Context;
	name: string;
	default_value?: Tag_result;
	attributes: Attribute[];
}

function get_attribute_value(attribute_name: string, tag: Tag) {
    const attribute = tag.attributes.find(attribute => attribute.name === attribute_name);
    if (!attribute) {
        throw `Tried to obtain value "${attribute_name}" from tag "${tag.name}", but no such attribute exists. Valid attributes: [${tag.attributes.reduce((curr, attribute) => `${curr} ${attribute.name}`, "")} ]`;
    }
    return attribute.value;
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

enum Page_availability {
    Available, Unavailable, Unknown
}
class Page_checker {
    private static debug = false;
    static page_available(arc: string, scene: string): Page_availability {
        this.debug && console.log(`Checking availability `)
        let available = this.choice_available.get(`${arc}/${scene}`);
        if (available === undefined) {
            this.debug && console.log(`But we don't know if it's available yet, so we assume no and add it to the list to look it up later.`);
            return Page_availability.Unknown;
        }
        this.debug && console.log(`We know that page ${arc}/${scene} is ${available ? "available" : "unavailable"}`);
        return available ? Page_availability.Available : Page_availability.Unavailable;
    }
    static async update_page_available(arc: string, scene: string) {
        try {
            await get(`${arc}/${scene}.txt`);
            this.choice_available.set(`${arc}/${scene}`, true);
            this.debug && console.log(`Source for page ${arc}/${scene} is available`);
            return true;
        }
        catch (error) {
            this.choice_available.set(`${arc}/${scene}`, false);
            this.debug && console.log(`Source for page ${arc}/${scene} is not available because ${error}`);
            return false;
        }
    }
    private static choice_available = new Map<string, boolean>();
}

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
		intro: Tag_result.from_html("<img"),
		replacements:
			[
				{name: "url", replacement: url => Tag_result.from_html(` src="${url.plaintext}"`)},
				{name: "alt", replacement: alt => Tag_result.from_html(` alt="${escape_html(alt.plaintext)}"`), default_value: Tag_result.from_html(" alt='image'")},
            ],
		outro: Tag_result.from_html("/>\n"),
	},
	{ //code
		tag_name: "code",
		intro: Tag_result.from_html("<a class='code'>"),
		replacements:
			[
				{name: "text", replacement: text => Tag_result.from_html(escape_html(text.plaintext))},
            ],
		outro: Tag_result.from_html("</a>\n"),
	},
	{ //choice
		tag_name: "choice",
        intro: Tag_result.from_html("<a"),
		replacements:
			[
				{name: "next", replacement: next => {
                    switch (Page_checker.page_available(current_arc, next.plaintext)) {
                        case Page_availability.Available:
                            return Tag_result.from_html(` class='choice' href="#${current_arc}/${next.plaintext}"`);
                        case Page_availability.Unavailable:
                            return Tag_result.from_html(` class='dead_choice'`);
                        case Page_availability.Unknown:
                            //TODO: Add async function that looks up current_arc/next and does document.querySelector("#choice_${current_arc}/${next}").class = ...;
                            return Tag_result.from_html(` id='choice_${current_arc}/${next.plaintext}'`);
                    }
                }},
                {name: "onclick", replacement: (onclick, tag) => Page_checker.page_available(current_arc, get_attribute_value("next", tag).plaintext) ?
                    Tag_result.from_html(` onclick="${onclick.plaintext.replace(/"/g, "&quot;")};return true"`) : Tag_result.from_html(""), default_value: Tag_result.from_plaintext("")},
                {name: "text", replacement: text => Tag_result.from_html('>' + escape_html(text.plaintext))},
            ],
        outro: Tag_result.from_html("</a>\n"),
	},
    { //test
		tag_name: "test",
        intro: Tag_result.from_html("<a>"),
		replacements:
			[
                {name: "text", replacement: text => {
                    false && console.log(`Test tag text: ${text.plaintext}`);
                    return Tag_result.from_html(text.plaintext);
                }},
            ],
        outro: Tag_result.from_html("</a>\n"),
	},
	{ //source
        tag_name: "source",
        intro: Tag_result.from_html('<hr>'),
		replacements: () => {
            const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
            return Tag_result.from_html(`<a href="${`${current_url}story arcs/${current_arc}/${current_scene}.txt`}">Source</a><br>\n<p class="source">${escape_html(current_source)}</p>`);
        },
    },
    { //exec
        tag_name: "exec",
        replacements: function(tag: Tag) {
            for (const attribute of tag.attributes) {
                const code = get_attribute_value(attribute.name, tag);
                //TODO: Error handling
                g.set(attribute.name, evaluate(code.plaintext));
            }
            return Tag_result.from_plaintext("");
        },
    },
    { //print
        tag_name: "print",
        replacements: 
        [
            {name: "variable", replacement: text => Tag_result.from_plaintext(evaluate_variable(text.plaintext))},
        ],
    },
];

function remove_escapes(text: string) {
    return text.replace(/\\(.)/g, '$1');
}

function html_comment(content: string) {
	return `<!-- ${content.replace(/-->/g, "~~>")} -->\n`;
}

function execute_tag(tag: Tag): Tag_result {
    const debug = false;
    debug && console.log(`Executing tag "${tag.name}" with value "${tag.default_value?.current_value}" and attributes [${tag.attributes.length > 0 ?
        tag.attributes.reduce((curr, attribute) => `${curr}\t${attribute.name}="${attribute.value.current_value}"\n`, "\n") : ""}]\n`);
    const replacement = replacements.find((repl) => repl.tag_name === tag.name);
    if (replacement === undefined) {
        throw "Unknown tag " + tag.name;
    }
    //Todo: check if there are no duplicate attributes
    let result = replacement.intro || Tag_result.from_plaintext("");
    if (typeof replacement.replacements === "function") {
        result = result.append(replacement.replacements(tag));
    }
    else {
        if (tag.default_value?.current_value) {
            tag.attributes.push({name: replacement.replacements[0].name, value: tag.default_value});
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
                    throw `Missing attribute "${attribute_replacement.name}" in tag "${tag.name}"`;
                }
            }
            result = result.append(attribute_replacement.replacement(attribute_value.value, tag));
            if (attribute_value_pos !== -1) {
                attributes.splice(attribute_value_pos, 1);
            }
        }
        if (attributes.length > 0) {
            throw `Unknown attribute(s) [${attributes.reduce((curr, attr) => `${curr}${attr.name} `, " ")}] in tag "${tag.name}"`;
        }
    }
    if (replacement.outro) {
        result = result.append(replacement.outro);
    }
    return result;
}

function evaluate_richtext(ctx: cyoaeParser.Rich_text_Context): Tag_result {
    const debug = false;
    let result = Tag_result.from_plaintext("");
    for (let i = 0; i < ctx.childCount; i++) {
        const child = ctx.getChild(i);
        debug && console.log(`Tag child ${i}: >>>${child.text}<<<`);
        if (child instanceof cyoaeParser.Plain_text_Context) {
            for (let i = 0; i < child.childCount; i++) {
                const grandchild = child.getChild(i);
                if (grandchild instanceof cyoaeParser.Escaped_text_Context) {
                    if (grandchild.text.length !== 2) {
                        throw `Invalid escape sequence: ${grandchild.text}`;
                    }
                    result = result.append_plaintext(grandchild.text[1]); //cut off the \
                }
                else {
                    result = result.append_plaintext(grandchild.text);
                }
            }
        }
        else if (child instanceof cyoaeParser.Tag_Context) {
            function extract_tag(ctx: cyoaeParser.Tag_Context): Tag {
                let tag: Tag = {
                    ctx: ctx,
                    name: "",
                    attributes: []
                };
                for (let i = 0; i < ctx.childCount; i++) {
                    const child = ctx.getChild(i);
                    //debug && console.log(`Tag child ${i}`);
                    if (child instanceof cyoaeParser.Tag_name_Context) {
                        debug && console.log(`Got a tag name "${child.text}"`);
                        tag.name = child.text;
                    }
                    else if (child instanceof cyoaeParser.Default_value_Context) {
                        debug && console.log(`Got a tag default value "${child.text}"`);
                        const rich_text_child = child.getChild(0);
                        if (!(rich_text_child instanceof cyoaeParser.Rich_text_Context)) {
                            throw "Internal logic error: Child of default value is not rich text";
                        }
                        tag.default_value = Tag_result.from_ctx(rich_text_child);
                    }
                    else if (child instanceof cyoaeParser.Attribute_Context) {
                        let name_ctx: cyoaeParser.Attribute_name_Context | undefined;
                        let value_ctx: cyoaeParser.Attribute_value_Context | undefined;
                        for (let i = 0; i < child.childCount; i++) {
                            const grandchild = child.getChild(i);
                            if (grandchild instanceof cyoaeParser.Attribute_name_Context) {
                                name_ctx = grandchild;
                            }
                            else if (grandchild instanceof cyoaeParser.Attribute_value_Context) {
                                value_ctx = grandchild;
                            }
                        }
                        if (!name_ctx) {
                            throw "Internal logic error: Failed finding attribute name in attribute";
                        }
                        if (!value_ctx) {
                            throw "Internal logic error: Failed finding attribute value in attribute";
                        }
                        const rich_text_value_ctx = value_ctx.getChild(0);
                        if (!(rich_text_value_ctx instanceof cyoaeParser.Rich_text_Context)) {
                            throw "Internal logic error: Child of attribute value is not rich text";
                        }
                        tag.attributes.push({name: name_ctx.text, value: Tag_result.from_ctx(rich_text_value_ctx)});
                    }
                    else if (child instanceof cyoaeParser.Tag_open_Context) {}
                    else if (child instanceof cyoaeParser.Tag_close_Context) {}
                    else if (child instanceof cyoaeParser.Ws_Context) {}
                    else {
                        throw `Internal logic error: Found unknown child in rich text: ${child.text}`;
                    }
                }
                return tag;
            }
            result = result.append(execute_tag(extract_tag(child)));
        }
        else {
            throw `Internal logic error: Found child that is neither a plain text nor a tag in rich text`;
        }
    }
    debug && console.log(`Tag execution result: ${result.current_value}`);
    return result;
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
    
    const tree = parser.start_();
    //const listener = new(Listener as any)();
    //ParseTreeWalker.DEFAULT.walk(listener, tree);
    const child = tree.getChild(0);
    if (!(child instanceof cyoaeParser.Rich_text_Context)) {
        throw "Internal logic error: Child of start context is not a richtext";
    }
    return evaluate_richtext(child).html;
}

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/variables`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    const debug = false;
    debug && console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        current_source = await get(`${current_scene}.txt`);
        document.body.innerHTML = parse_source_text(current_source, `${current_scene}.txt`);
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}

async function url_hash_change () {
    const debug = false;
    const [, arc, scene] = window.location.hash.match(/#([^\/]*)\/(.*)/) || [];
    debug && console.log(`URL changed to ${arc}/${scene}`);
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
        const details = `\n>Value >>>${predicate}<<<`;
        const source = ` in ${(new Error()).stack?.split("\n")[1]}`;
        if (explanation) {
            throw `Assertion fail${source}:${details}${explanation ? "\n" + explanation : ""}`;
        }
        throw `Assertion fail: ${predicate}`;
    }
}

function assert_equal(left: any, right: any, explanation?: any) {
    if (left !== right) {
        const details = `\n>>Actual: >>>${left}<<<\nExpected: >>>${right}<<<`;
        const source = ` in ${(new Error()).stack?.split("\n")[1]}`;
        if (explanation) {
            throw `Assertion fail${source}:${details}${explanation ? "\n" + explanation : ""}`;
        }
        throw `Assertion fail${source}: ${details}`;
    }
}

function tests() {
    let text = Tag_result.from_plaintext("111");
    text = text.append_plaintext("222");
    assert_equal(text.plaintext, "111222", "First try");
    let html = text.html;
    assert_equal(html.split("111").length, 2, html);
    assert_equal(html.split("222").length, 2, html);
    assert_equal(text.plaintext, "111222", text.plaintext);
    text = text.append_html("333");
    html = text.html;
    assert_equal(html.split("111").length, 2, html);
    assert_equal(html.split("222").length, 2, html);
    assert_equal(html.split("333").length, 2, html);
    text = text.append_html("444");
    html = text.html;
    assert_equal(html.split("111").length, 2, html);
    assert_equal(html.split("222").length, 2, html);
    assert_equal(html.split("333").length, 2, html);
    assert_equal(html.split("444").length, 2, html);
    text = text.append_plaintext("555");
    html = text.html;
    assert_equal(html.split("111").length, 2, html);
    assert_equal(html.split("222").length, 2, html);
    assert_equal(html.split("333").length, 2, html);
    assert_equal(html.split("444").length, 2, html);
    assert_equal(html.split("555").length, 2, html);
    text = text.append_plaintext("666");
    html = text.html;
    assert_equal(html.split("111").length, 2, html);
    assert_equal(html.split("222").length, 2, html);
    assert_equal(html.split("333").length, 2, html);
    assert_equal(html.split("444").length, 2, html);
    assert_equal(html.split("555").length, 2, html);
    assert_equal(html.split("666").length, 2, html);

    let result = parse_source_text("[test {text test1}]", "test");
    let expected = "<a>test1</a>\n";
    assert_equal(result, expected, `Checking test tag 1. Expected:\n>>>${expected}<<<\nActual:\n>>>${result}<<<`);

    result = parse_source_text("[test {text test1}]", "test");
    expected = "<a>test1</a>\n";
    assert_equal(result, expected, `Checking test tag 2. Expected:\n${expected}Actual:\n${result}`);

    result = parse_source_text("[test {text test1}][test {text test2}]", "test");
    expected = "<a>test1</a>\n<a>test2</a>\n";
    assert_equal(result, expected, `Checking test tag 3. Expected:\n${expected}Actual:\n${result}`);
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        tests();
    }
    catch (err) {
        console.error(`Tests failed: ${err}`);
        return;
    }
    try {
        await play_arc("intro");
        await url_hash_change();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();