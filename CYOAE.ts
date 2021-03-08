"use strict";

import * as antlr4ts from 'antlr4ts';
import { cyoaeLexer } from './cyoaeLexer';
import * as cyoaeParser from './cyoaeParser';

let current_arc = "";
let current_scene = "";
let current_source = "";

class ParserErrorListener implements antlr4ts.ANTLRErrorListener<antlr4ts.Token> {
    syntaxError(recognizer: antlr4ts.Recognizer<antlr4ts.Token, any>, offendingSymbol: antlr4ts.Token | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {
        throw_evaluation_error(`Parser error: ${msg}`, {start: {line: line, charPositionInLine: charPositionInLine}, sourceInterval: {length: offendingSymbol?.text?.length || 0}});
    }
}

class LexerErrorListener implements antlr4ts.ANTLRErrorListener<number> {
    syntaxError(recognizer: antlr4ts.Recognizer<number, any>, offendingSymbol: number | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {
        throw_evaluation_error(`Lexer error: ${msg}`, {start: {line: line, charPositionInLine: charPositionInLine}, sourceInterval: {length: 1}});
    }
}

class Lazy_evaluated<T> {
    private _value: T | undefined;
    constructor(private init: () => T) {}
    get value() {
        if (!this.is_evaluated) {
            this._value = this.init();
        }
        return this._value;
    }
    get is_evaluated() {
        return typeof this._value !== "undefined";
    }
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
        if (this.value.is_plaintext_available) {
            return this.value.current_plaintext;
        }
        throw "Plaintext unavailable";
    }
    get html(): string {
        return this.value.current_html + Tag_result.plain_to_html(this.value.current_plaintext);
    }
    get is_plaintext_available() {
        return this.value.current_html.length === 0;
    }
    get current_value() {
        if (this.context_value?.is_evaluated) {
            if (this.value.current_html) {
                return this.value.html;
            }
            return this.value.plaintext;
        }
        return "unevaluated";
    }
    append(other: Tag_result) {
        return other.is_plaintext_available ? this.value.append_plaintext(other.plaintext) : this.value.append_html(other.html);
    }
    append_plaintext(text: string) {
        if (text.length === 0) {
            return this.value;
        }
        return new Tag_result(undefined, this.value.current_html, this.value.current_plaintext + text);
    }
    append_html(text: string) {
        if (text.length === 0) {
            return this.value;
        }
        return new Tag_result(undefined, this.value.html + text, "");
    }
    private readonly context_value?: Lazy_evaluated<Tag_result>;
    private readonly current_html: string;
    private readonly current_plaintext: string;
    private static plain_to_html(text: string) {
        return escape_html(text);
    }
    private constructor(ctx: cyoaeParser.Rich_text_Context | undefined, html: string, plaintext: string) {
        if (ctx) {
            this.context_value = new Lazy_evaluated(() => evaluate_richtext(ctx));
        }
        this.current_plaintext = plaintext;
        this.current_html = html;
    }
    private get value() {
        return this.context_value?.value || this;
    }
}

interface Attribute_replacement {
	name: string;
	replacement(value: Tag_result, tag: Tag): Tag_result;
	default_value?: Tag_result;
}

enum Tag_type {
    allow_duplicate_attributes,
}

interface Tag_replacement {
    readonly tag_name: string;
    readonly intro?: Tag_result;
    readonly replacements: Attribute_replacement[] | ((tag: Tag) => Tag_result);
    readonly outro?: Tag_result;
    readonly tag_type?: Tag_type;
}

interface Tag {
	ctx: cyoaeParser.Tag_Context;
	name: string;
	default_value?: Tag_result;
	attributes: [string, Tag_result][];
}

function get_optional_attributes(tag: Tag, attribute: string) {
    let result: Tag_result[] = [];
    for (const [attribute_name, attribute_value] of tag.attributes) {
        if (attribute_name === attribute) {
            result.push(attribute_value);
        }
    }
    return result;
}

function get_unique_optional_attribute(tag: Tag, attribute: string) : Tag_result | undefined {
    const result = get_optional_attributes(tag, attribute);
    if (result.length > 1) {
        throw_evaluation_error(`Duplicate attribute "${attribute}" in tag "${tag.name}" which doesn't allow duplicate attributes`, tag.ctx);
    }
    return result[0];
}

function get_unique_required_attribute(tag: Tag, attribute: string) {
    const result = get_unique_optional_attribute(tag, attribute);
    if (typeof result === "undefined") {
        throw_evaluation_error(`Missing required attribute "${attribute}" in tag "${tag.name}"`, tag.ctx);
    }
    return result;
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
        this.debug && console.log(`Checking availability of ${arc}/${scene}`);
        const available = this.choice_available.get(`${arc}/${scene}`);
        if (typeof available === "boolean") {
            this.debug && console.log(`We know that page ${arc}/${scene} is ${available ? "available" : "unavailable"}`);
            return available ? Page_availability.Available : Page_availability.Unavailable;
        }
        else if (available === undefined) {
            this.debug && console.log(`But we don't know if it's available yet, nobody has fetched it yet.`);
        }
        else {
            this.debug && console.log(`But we don't know if it's available yet, but it's being fetched.`);
        }
        return Page_availability.Unknown;
    }
    static async fetch_page_available(arc: string, scene: string) {
        const available = this.choice_available.get(`${arc}/${scene}`);
        if (typeof available === "boolean") {
            return available;
        }
        if (available === undefined) {
            const promise = (async () => {
                try {
                    await download(`${arc}/${scene}.txt`);
                    this.choice_available.set(`${arc}/${scene}`, true);
                    this.debug && console.log(`Source for page ${arc}/${scene} is available`);
                    return true;
                }
                catch (error) {
                    this.choice_available.set(`${arc}/${scene}`, false);
                    this.debug && console.log(`Source for page ${arc}/${scene} is not available because ${error}`);
                    return false;
                }
            })();
            this.choice_available.set(`${arc}/${scene}`, promise);
            return promise;
        }
        return available;
    }
    private static choice_available = new Map<string, boolean | Promise<boolean>>();
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

class Delayed_evaluation {
    private static debug = false;
    private static delayed_evaluation_placeholder_number = 0;
    private static delay_evaluation_promise = (async () => {})();
    private static active_delayed_evaluations = 0;

    //returns a placeholder that will be replaced by the real thing later
    static evaluate(replacement: Promise<Tag_result>, placeholder_text = Tag_result.from_plaintext("[loading]")): Tag_result {
        const placeholder_id = `delayed_evaluation_placeholder_${this.delayed_evaluation_placeholder_number}`;
        const placeholder = Tag_result.from_html(`<slot class="placeholder" id="${placeholder_id}">${placeholder_text.html}</slot>`);
        this.active_delayed_evaluations += 1;
        const old_promise = this.delay_evaluation_promise;
        this.delay_evaluation_promise = (async () => {
            const result = await replacement;
            let link = document.querySelector(`#${placeholder_id}`);
            if (link) {
                this.debug && console.log(`Replacement: "${link.outerHTML}" to "${result.html}"`);
                link.outerHTML = result.html;
            }
            else {
                console.error(`Failed finding ID "${placeholder_id}" for replacement`);
            }
            this.active_delayed_evaluations -= 1;
            return old_promise;
        })();
        this.delayed_evaluation_placeholder_number += 1;
        return placeholder;
    }

    static get has_everything_been_evaluated() {
        return this.active_delayed_evaluations === 0;
    }

    static async wait_for_everything_to_be_evaluated() {
        return this.delay_evaluation_promise;
    }
}

const replacements: Tag_replacement[] = [
	{ //img
		tag_name: "img",
		intro: Tag_result.from_html("<img"),
		replacements:
			[
				{name: "url", replacement: url => Tag_result.from_html(` src="${url.plaintext}"`)},
				{name: "alt", replacement: alt => Tag_result.from_html(` alt="${escape_html(alt.plaintext)}"`), default_value: Tag_result.from_plaintext("image")},
            ],
		outro: Tag_result.from_html("/>\n"),
	},
	{ //code
		tag_name: "code",
		intro: Tag_result.from_html("<span class='code'>"),
		replacements:
			[
				{name: "text", replacement: text => Tag_result.from_html(escape_html(text.plaintext))},
            ],
		outro: Tag_result.from_html("</span>\n"),
	},
	{ //choice
		tag_name: "choice",
		replacements: (tag) => {
            const next = get_unique_required_attribute(tag, "next");
            const text = get_unique_required_attribute(tag, "text");
            const onclick = get_unique_optional_attribute(tag, "onclick");
            //TODO: assert that tag.attributes has no attributes besides next, text and onclick
            function get_result(page_available: boolean) {
                //intro
                let result = Tag_result.from_html("<a");
                //next
                result =
                    page_available
                    ? result.append_html(` class='choice' href="#${current_arc}/${next.plaintext}"`)
                    : result.append_html(` class='dead_choice'`);
                //onclick
                result =
                    page_available && onclick
                    ? result.append_html(` onclick="${onclick.plaintext.replace(/"/g, "&quot;")};return true"`)
                    : result;
                //text
                result = result.append_html(">" + text.plaintext);
                //outro
                result = result.append_html("</a>\n");
                return result;
            }
            switch (Page_checker.page_available(current_arc, next.plaintext)) {
                case Page_availability.Available:
                    return get_result(true);
                case Page_availability.Unavailable:
                    return get_result(false);
                case Page_availability.Unknown:
                    return Delayed_evaluation.evaluate((async () => {
                        return get_result(await Page_checker.fetch_page_available(current_arc, next.plaintext));
                    })(), text);
            }
        },
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
    { //test delayed evaluation
		tag_name: "test_delayed_evaluation",
		replacements: (tag) => {
            return Delayed_evaluation.evaluate((async () => Tag_result.from_plaintext("test_delayed_evaluation_result"))(), Tag_result.from_plaintext("test_delayed_evaluation_placeholder"));
        }
	},
	{ //source
        tag_name: "source",
        intro: Tag_result.from_html('<hr>'),
		replacements: () => {
            const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
            return Tag_result.from_html(`<a href="${`${current_url}story arcs/${current_arc}/${current_scene}.txt`}">Source</a><br>\n<p class="source">${escape_html(current_source)}</p>`);
        },
    },
    { //print
        tag_name: "print",
        replacements: 
        [
            {name: "variable", replacement: text => Tag_result.from_plaintext(evaluate_variable(text.plaintext))},
        ],
    },
    { //select
        tag_name: "select",
        replacements: function(tag: Tag) {
            let debugstring = `Select attributes:\n`;
            for (const [attribute_name, code] of tag.attributes) {
                debugstring += `${attribute_name}: ${code.current_value}\n`;
            }
            console.log(debugstring);
            return Tag_result.from_plaintext("");
        },
        tag_type: Tag_type.allow_duplicate_attributes,
    },
];

function html_comment(content: string) {
	return `<!-- ${content.replace(/-->/g, "~~>")} -->\n`;
}

function reduce<Key_type, Value_type, Accumulator_type>(map: Map<Key_type, Value_type>, reducer: {(current_value: Accumulator_type, key_value: [Key_type, Value_type]): Accumulator_type}, accumulator: Accumulator_type) {
    for (const key_value of map) {
        accumulator = reducer(accumulator, key_value);
    }
    return accumulator;
}

interface Evaluation_error_context {
    readonly start: {line: number, charPositionInLine: number};
    readonly sourceInterval: {length: number};
}
type Extends<Class, Interface, Message = "">  = Class extends Interface ? true : Message;
function static_assert<T extends true>() {}
static_assert<Extends<antlr4ts.ParserRuleContext, Evaluation_error_context, "antlr4ts.ParserRuleContext doesn't implement Evaluation_error_context anymore, need to change Evaluation_error_context so it does again">>();

function throw_evaluation_error(error: string, context: Evaluation_error_context): never {
    const line = context.start.line;
    const character = context.start.charPositionInLine;
    const source_line = current_source.split('\n')[line - 1];
    function min(x: number, y: number) {
        return x < y ? x : y;
    }
    const length = min(context.sourceInterval.length, source_line.length - character);

    throw `Error evaluating source in line ${line}:\n`
        +`${source_line}\n`
        + `${" ".repeat(character) + "^" + (length > 1 ? "~".repeat(length - 1) : "")}\n`
        + error;
}

function evaluate_expression(expression: cyoaeParser.Expression_Context): number | string | void {
    if (expression._operator) {
        switch (expression._operator.text) {
            case "=":
                const value = evaluate_expression(expression._expression);
                if (typeof value === "undefined") {
                    throw_evaluation_error(`Cannot assign value "${expression._expression.text}" to variable "${expression._identifier.text}" because the expression does not evaluate to a value.`, expression);
                }
                g.set(expression._identifier.text, value);
                break;
            case "+":
            case "-":
            case "*":
            case "/":
                const lhs = evaluate_expression(expression._left_expression);
                const rhs = evaluate_expression(expression._right_expression);
                if (typeof lhs === "number" && typeof rhs === "number") {
                    switch (expression._operator.text) {
                        case "+":
                            return lhs + rhs;
                        case "-":
                            return lhs - rhs;
                        case "*":
                            return lhs * rhs;
                        case "/":
                            if (rhs === 0) {
                                throw_evaluation_error(`Zero division error: "${expression.text}" evaluated to ${lhs} / ${rhs}`, expression);
                            }
                            return lhs / rhs;
                        }
                }
                if (typeof lhs === "string" && typeof rhs === "string" && expression._operator.text === "+") {
                    return lhs + rhs;
                }
                throw_evaluation_error(`Failed evaluating "${expression._left_expression.text}" (evaluated to value "${lhs}" of type ${typeof lhs}) ${expression._operator.text} "${expression._right_expression.text}" (evaluated to value "${rhs}" of type ${typeof rhs})`, expression);
            default:
                throw_evaluation_error(`TODO: Need to implement evaluating expression "${expression.text}"`, expression);
        }
    } else {
        if (expression._identifier) {
            const value = g.get(expression._identifier.text);
            if (typeof value === "undefined") {
                throw_evaluation_error(`Variable "${expression._identifier.text}" is undefined`, expression);
            }
            return value;
        }
        else if (expression._number) {
            return parseInt(expression._number.text);
        }
        else if (expression._expression) {
            return evaluate_expression(expression._expression);
        }
        else if (expression._string) {
            return expression._string.text;
        }
        else {
            throw_evaluation_error(`Unknown expression ${expression.text}`, expression);
        }
    }
}

function evaluate_code(code: cyoaeParser.Code_Context) {
    for (let i = 0; i < code.childCount; i++) {
        const child = code.getChild(i);
        if (child instanceof cyoaeParser.Statement_Context) {
            evaluate_expression(child._expression);
        }
        else if (child instanceof cyoaeParser.Expression_Context) {
            return evaluate_expression(child);
        }
    }
}

function execute_tag(tag: Tag): Tag_result {
    const debug = false;
    debug && console.log(`Executing tag "${tag.name}" with value "${tag.default_value?.current_value}" and attributes [${
        tag.attributes.length > 0
        ? tag.attributes.reduce((curr, [attribute_name, attribute_value]) => `${curr}\t${attribute_name}="${attribute_value.current_value}"\n`, "\n")
        : ""
    }]\n`);
    const replacement = replacements.find((repl) => repl.tag_name === tag.name);
    if (replacement === undefined) {
        throw_evaluation_error(`Unknown tag "${tag.name}"`, tag.ctx);
    }
    //check that there are no duplicate attributes
    if (replacement.tag_type !== Tag_type.allow_duplicate_attributes) {
        let attribute_names = new Set<string>();
        for (const [attribute_name, ] of tag.attributes) {
            if (attribute_names.has(attribute_name)) {
                throw_evaluation_error(`Found duplicate attribute ${attribute_name} in tag ${tag.name} which doesn't support that`, tag.ctx);
            }
            attribute_names.add(attribute_name);
        }
    }
    let result = replacement.intro || Tag_result.from_plaintext("");
    if (typeof replacement.replacements === "function") {
        try {
            result = result.append(replacement.replacements(tag));
        }
        catch (error) {
            throw_evaluation_error(`${error}`, tag.ctx);
        }
    }
    else {
        if (tag.default_value?.current_value) {
            debug && console.log(`Found default value ${tag.default_value?.current_value}`);
            tag.attributes.push([replacement.replacements[0].name, tag.default_value]);
        }
        const attributes = [...tag.attributes];
        debug && console.log(`Found attributes that need to be looked up: ${attributes.reduce((curr, [name, ])=>`${curr} ${name}`, "")}`);
        for (const attribute_replacement of replacement.replacements) {
            const attribute_value_pos = attributes.findIndex(([attribute_name,]) => attribute_name === attribute_replacement.name);

            let attribute_value = attributes[attribute_value_pos]?.[1];
            if (!attribute_value) {
                if (attribute_replacement.default_value !== undefined) {
                    attribute_value = attribute_replacement.default_value;
                }
                else {
                    throw_evaluation_error(`Missing attribute "${attribute_replacement.name}" in tag "${tag.name}"`, tag.ctx);
                }
            }
            try {
                result = result.append(attribute_replacement.replacement(attribute_value, tag));
            }
            catch (error) {
                throw_evaluation_error(`${error}`, tag.ctx);
            }
            if (attribute_value_pos !== -1) {
                attributes.splice(attribute_value_pos, 1);
            }
        }
        if (attributes.length > 0) {
            throw_evaluation_error(`Unknown attribute(s) [${attributes.reduce((curr, [attr_name, ]) => `${curr}${attr_name} `, " ")}] in tag "${tag.name}"`, tag.ctx);
        }
    }
    if (replacement.outro) {
        result = result.append(replacement.outro);
    }
    return result;
}

function evaluate_richtext(ctx: cyoaeParser.Rich_text_Context): Tag_result {
    const debug = false;
    debug && console.log(`Evaluating richtext "${ctx.text}"`);
    let result = Tag_result.from_plaintext("");
    for (let i = 0; i < ctx.childCount; i++) {
        const child = ctx.getChild(i);
        debug && console.log(`Tag child ${i}: >>>${child.text}<<<`);
        if (child instanceof cyoaeParser.Plain_text_Context) {
            debug && console.log(`found plaintext "${child.text}"`);
            for (let i = 0; i < child.childCount; i++) {
                const grandchild = child.getChild(i);
                if (grandchild instanceof cyoaeParser.Escaped_text_Context) {
                    if (grandchild.text.length !== 2) {
                        throw_evaluation_error(`Invalid escape sequence: ${grandchild.text}`, grandchild);
                    }
                    result = result.append_plaintext(grandchild.text[1]); //cut off the \
                }
                else {
                    result = result.append_plaintext(grandchild.text);
                }
            }
        }
        else if (child instanceof cyoaeParser.Tag_Context) {
            debug && console.log(`evaluating tag ${child._tag_name.text}`);
            function extract_tag(ctx: cyoaeParser.Tag_Context): Tag {
                let tag: Tag = {
                    ctx: ctx,
                    name: ctx._tag_name.text,
                    attributes: []
                };

                if (ctx._default_value.text) {
                    debug && console.log(`Got a tag default value "${ctx._default_value.text}"`);
                    tag.default_value = Tag_result.from_ctx(ctx._default_value);
                }

                for (let i = 0; i < ctx.childCount; i++) {
                    const child = ctx.getChild(i);
                    if (child instanceof cyoaeParser.Attribute_Context) {
                        tag.attributes.push([child._attribute_name.text, Tag_result.from_ctx(child._attribute_value)]);
                    }
                }
                return tag;
            }
            result = result.append(execute_tag(extract_tag(child)));
        }
        else if (child instanceof cyoaeParser.Code_Context) {
            debug && console.log(`Evaluating code "${child.text}"`);
            const value = evaluate_code(child);
            debug && console.log(`Result: "${value}"`);
            if (typeof value !== "undefined") {
                result = result.append_plaintext(`${value}`);
            }
        }
        else if (child instanceof cyoaeParser.Number_Context) {
            debug && console.log(`Found number ${child.text}`);
            result = result.append_plaintext(child.text);
        }
        else {
            throw_evaluation_error(`Internal logic error: Found child that is neither a plain text nor a tag nor a number in rich text`, ctx);
        }
    }
    debug && console.log(`Tag execution result: "${result.current_value}" which is ${result.is_plaintext_available ? "plaintext" : "html"}`);
    return result;
}

function get_parser(data: string, filename: string) {
    current_source = data;
    const input = antlr4ts.CharStreams.fromString(data, filename);
    const lexer = new cyoaeLexer(input);
    const tokens = new antlr4ts.CommonTokenStream(lexer);
    const parser = new cyoaeParser.cyoaeParser(tokens);

    lexer.removeErrorListeners();
    lexer.addErrorListener(new LexerErrorListener);
    parser.removeErrorListeners();
    parser.addErrorListener(new ParserErrorListener);

    return parser;
}

function parse_source_text(data: string, filename: string) {
    console.log(`Starting parsing source text ${filename}`);
    
    const tree = get_parser(data, filename).start_();
    const child = tree.getChild(0);
    if (!(child instanceof cyoaeParser.Rich_text_Context)) {
        throw "Internal logic error: Child of start context is not a richtext";
    }
    return evaluate_richtext(child).html;
}

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/travel`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    const debug = false;
    debug && console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        document.body.innerHTML = `<div class="main">${parse_source_text(await download(`${current_arc}/${current_scene}.txt`), `${current_scene}.txt`)}</div>`;
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
async function download(url: string) {
    const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
    const filepath = `${current_url}story arcs/${url}`;
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
    document.body.innerHTML = `<span class='error'>${escape_html(error)}</span>`;
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

async function tests() {
    function test_Tag_result() {
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
    }
    test_Tag_result();

    function test_tag_parsing() {
        let result = parse_source_text("[test {text test1}]", "test_tag_parsing");
        let expected = "<a>test1</a>\n";
        assert_equal(result, expected, `Checking test tag 1. Expected:\n>>>${expected}<<<\nActual:\n>>>${result}<<<`);

        result = parse_source_text("[test {text test1}]", "test_tag_parsing");
        expected = "<a>test1</a>\n";
        assert_equal(result, expected, `Checking test tag 2. Expected:\n${expected}Actual:\n${result}`);

        result = parse_source_text("[test {text test1}][test {text test2}]", "test_tag_parsing");
        expected = "<a>test1</a>\n<a>test2</a>\n";
        assert_equal(result, expected, `Checking test tag 3. Expected:\n${expected}Actual:\n${result}`);
    }
    test_tag_parsing();

    async function test_delayed_evaluation() {
        const debug = false;
        const result = parse_source_text("[test_delayed_evaluation]", "test_delayed_evaluation");
        assert(result.includes("test_delayed_evaluation_placeholder"), `test_delayed_evaluation_placeholder not found: ${result}`);
        assert(!result.includes("test_delayed_evaluation_result"), `test_delayed_evaluation_result found prematurely: ${result}`);
        document.body.innerHTML = result;
        debug && console.log(`Result: "${result}"`);
        debug && console.log(`HTML: "${document.body.innerHTML}"`);
        assert(document.body.innerHTML.includes("test_delayed_evaluation_placeholder"), `test_delayed_evaluation_placeholder not found: ${document.body.innerHTML}`);
        assert(!document.body.innerHTML.includes("test_delayed_evaluation_result"), `test_delayed_evaluation_result found prematurely: ${document.body.innerHTML}`);
        await Delayed_evaluation.wait_for_everything_to_be_evaluated();
        assert(Delayed_evaluation.has_everything_been_evaluated, "Everything should be evaluated after waiting for it, but isn't.");
        assert(!document.body.innerHTML.includes("test_delayed_evaluation_placeholder"), `test_delayed_evaluation_placeholder found after evaluation: ${document.body.innerHTML}`);
        assert(document.body.innerHTML.includes("test_delayed_evaluation_result"), `test_delayed_evaluation_result not found after evaluation: ${document.body.innerHTML}`);
    }
    await test_delayed_evaluation();

    function test_code_evaluation() {
        function test_eval(code: string, expected: string | number | void) {
            assert_equal(evaluate_expression(get_parser(code, `code evaluation test "${code}"`).expression_()), expected, `for code "${code}"`);
        }
        test_eval("x=42");
        test_eval("x", 42);
        test_eval("x + 27", 69);
        test_eval("1+2*3", 7);
        test_eval("(1+2)*3", 9);
        try {
            test_eval("1/0");
            assert(false, `Zero division error did not produce exception`);
        } catch (e) {}
    }
    test_code_evaluation();
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        await tests();
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