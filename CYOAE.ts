"use strict";

import * as antlr4ts from 'antlr4ts';
import { cyoaeLexer } from './cyoaeLexer';
import * as cyoaeParser from './cyoaeParser';
import { Variable_storage, Variable_storage_types } from './storage';
import { create_variable_table } from './variables_screen';
import { createHTML } from './html';

let current_arc = "";
let current_scene = "";
let current_source = "";

class ParserErrorListener implements antlr4ts.ANTLRErrorListener<antlr4ts.Token> {
    constructor(private parser: antlr4ts.Parser) { }
    syntaxError(recognizer: antlr4ts.Recognizer<antlr4ts.Token, any>, offendingSymbol: antlr4ts.Token | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {
        throw_evaluation_error(`Parser error: ${msg}${e ? `: ${e.context?.toStringTree(this.parser)}` : ""}`, { start: { line: line, charPositionInLine: charPositionInLine }, sourceInterval: { length: offendingSymbol?.text?.length || 0 } }, current_source);
    }
}

class LexerErrorListener implements antlr4ts.ANTLRErrorListener<number> {
    syntaxError(recognizer: antlr4ts.Recognizer<number, any>, offendingSymbol: number | undefined, line: number, charPositionInLine: number, msg: string, e: antlr4ts.RecognitionException | undefined) {
        throw_evaluation_error(`Lexer error: ${msg}`, { start: { line: line, charPositionInLine: charPositionInLine }, sourceInterval: { length: 1 } }, current_source);
    }
}

class Lazy_evaluated<T> {
    private _value: T | undefined;
    constructor(private init: () => T) { }
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

class Lazy_evaluated_rich_text {
    private _value: Tag_result | cyoaeParser.Rich_text_Context;
    constructor(ctx: cyoaeParser.Rich_text_Context) {
        this._value = ctx;
    }
    get is_evaluated() {
        return this._value instanceof Tag_result;
    }
    get value() {
        if (this._value instanceof cyoaeParser.Rich_text_Context) {
            this._value = evaluate_richtext(this._value);
        }
        return this._value;
    }
    get maybe_unevaluated_value() {
        if (this._value instanceof cyoaeParser.Rich_text_Context) {
            return `(unevaluated)${this._value.text}`;
        }
        return this._value.current_value;
    }
}

function HTMLElement_to_string(who: HTMLElement) {
    let el = document.createElement("div");
    el.appendChild(who.cloneNode(true));
    let txt = el.innerHTML;
    return txt;
}

type Tag_types = cyoaeParser.Rich_text_Context | string | HTMLElement;

class Tag_result {
    get text(): string {
        let this_text: string;
        if (this.data instanceof Lazy_evaluated_rich_text) {
            this_text = this.data.value.text;
        }
        else if (this.data instanceof HTMLElement) {
            throw "Plaintext unavailable";
        }
        else {
            this_text = this.data;
        }
        return `${this.prev?.current_value || ""}${this_text}`;
    }
    insert_into(element: HTMLElement): void {
        if (this.prev) {
            element.append(this.prev.value);
        }
        element.append(this.value);
    }
    get is_text_available(): boolean {
        return typeof this.value === "string" && (this.prev?.is_text_available || true);
    }
    get current_value(): string {
        let this_text: string;
        if (this.data instanceof Lazy_evaluated_rich_text) {
            this_text = this.data.maybe_unevaluated_value;
        }
        else if (this.data instanceof HTMLElement) {
            this_text = HTMLElement_to_string(this.data);
        }
        else {
            this_text = this.data;
        }
        return `${this.prev?.current_value || ""}${this_text}`;
    }
    append(other: Tag_types | Tag_result): Tag_result {
        const debug = false;
        if (other instanceof Tag_result) {
            if (other.prev) {
                debug && console.log(`Entering append with other tag_result with children and value ${other.value}`);
                return new Tag_result(other.data, this.append(other.prev));
            }
            else {
                debug && console.log(`Entering append with other tag_result without children and value ${other.value}`);
                return new Tag_result(other.data, this);
            }
        }
        else {
            if (typeof other === "string" && other === "") {
                return this;
            }
            debug && console.log(`Entering append with other not tag_result and value ${other}`);
            if (typeof this.data === "string") {
                return new Tag_result(this.data + other, this.prev);
            }
            return this.append(new Tag_result(other));
        }
    }
    get range(): (string | HTMLElement)[] {
        const data: (string | HTMLElement)[] = [];
        for (let current: Tag_result | undefined = this; current; current = current.prev) {
            data.push(current.value);
        }
        return data.reverse();
    }
    private get value(): string | HTMLElement {
        return this.data instanceof Lazy_evaluated_rich_text ? this.data.value.value : this.data;
    }
    private readonly data: Lazy_evaluated_rich_text | string | HTMLElement;
    private readonly prev?: Tag_result;
    constructor(initializer: Tag_types | Lazy_evaluated_rich_text | [Tag_types | Lazy_evaluated_rich_text, ...(Tag_types | Lazy_evaluated_rich_text)[]], prev?: Tag_result) {
        if (Array.isArray(initializer)) {
            let result = new Tag_result(initializer.shift() || "");
            for (const object of initializer) {
                result = result.append(new Tag_result(object));
            }
            this.data = result.data;
            this.prev = result.prev;
            return;
        }
        this.prev = prev;
        this.data = initializer instanceof cyoaeParser.Rich_text_Context ? new Lazy_evaluated_rich_text(initializer) : initializer;
    }
}

interface Attribute_replacement {
    name: string;
    replacement(value: Tag_result, tag: Tag): Tag_result;
    default_value?: Tag_result;
}

interface Tag_replacement {
    readonly tag_name: string;
    readonly required_attributes: Readonly<string[]>;
    readonly optional_attributes: Readonly<string[]>;
    readonly replacements: (tag: Tag) => Tag_result;
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

function get_unique_optional_attribute(tag: Tag, attribute: string): Tag_result | undefined {
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

enum Page_availability {
    Available, Unavailable, Unknown
}
class Page_checker {
    private static debug = false;
    static page_available(arc: string, scene: string): Page_availability {
        Page_checker.debug && console.log(`Checking availability of ${arc}/${scene}`);
        const available = Page_checker.choice_available.get(`${arc}/${scene}`);
        if (typeof available === "boolean") {
            Page_checker.debug && console.log(`We know that page ${arc}/${scene} is ${available ? "available" : "unavailable"}`);
            return available ? Page_availability.Available : Page_availability.Unavailable;
        }
        else if (available === undefined) {
            Page_checker.debug && console.log(`But we don't know if it's available yet, nobody has fetched it yet.`);
        }
        else {
            Page_checker.debug && console.log(`But we don't know if it's available yet, but it's being fetched.`);
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
                    Page_checker.debug && console.log(`Source for page ${arc}/${scene} is available`);
                    return true;
                }
                catch (error) {
                    this.choice_available.set(`${arc}/${scene}`, false);
                    Page_checker.debug && console.log(`Source for page ${arc}/${scene} is not available because ${error}`);
                    return false;
                }
            })();
            Page_checker.choice_available.set(`${arc}/${scene}`, promise);
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
    private static delay_evaluation_promise = (async () => { })();
    private static active_delayed_evaluations = 0;

    //returns a placeholder that will be replaced by the real thing later
    static evaluate(replacement: Promise<Tag_result>, placeholder_text = new Tag_result("[loading]")): Tag_result {
        const placeholder_id = `delayed_evaluation_placeholder_${this.delayed_evaluation_placeholder_number}`;
        const slot = createHTML(["slot", { class: "placeholder", id: placeholder_id }]);
        placeholder_text.insert_into(slot);
        this.active_delayed_evaluations += 1;
        const old_promise = this.delay_evaluation_promise;
        this.delay_evaluation_promise = (async () => {
            const result = await replacement;
            let link = document.querySelector(`#${placeholder_id}`);
            if (link) {
                this.debug && console.log(`Replacement: "${link.outerHTML}" to "${result.current_value}"`);
                link.replaceWith(...result.range);
            }
            else {
                console.error(`Failed finding ID "${placeholder_id}" for replacement`);
            }
            this.active_delayed_evaluations -= 1;
            return old_promise;
        })();
        this.delayed_evaluation_placeholder_number += 1;
        return new Tag_result(slot);
    }

    static get has_everything_been_evaluated() {
        return this.active_delayed_evaluations === 0;
    }

    static async wait_for_everything_to_be_evaluated() {
        return this.delay_evaluation_promise;
    }
}

function get_attributes(tag: Tag, tag_replacement: Tag_replacement) {
    let result: { [key: string]: Tag_result } = {};
    for (const attr of tag_replacement.required_attributes) {
        result[attr] = get_unique_required_attribute(tag, attr);
    }
    for (const attr of tag_replacement.optional_attributes) {
        const attribute = get_unique_optional_attribute(tag, attr);
        if (attribute) {
            result[attr] = attribute;
        }
    }
    return result;
}

const replacements: Readonly<Tag_replacement[]> = [
    { //img
        tag_name: "img",
        required_attributes: ["url"],
        optional_attributes: ["alt"],
        replacements: function (tag): Tag_result {
            const attributes = get_attributes(tag, this);
            return new Tag_result(createHTML(["img", { src: attributes["url"].text, alt: attributes["alt"]?.text ?? "image" }]));
        },
    },
    { //code
        tag_name: "code",
        required_attributes: ["text"],
        optional_attributes: [],
        replacements: function (tag): Tag_result {
            const attributes = get_attributes(tag, this);
            return new Tag_result(createHTML(["span", { class: "code" }, ...attributes["text"].range]));
        },
    },
    { //choice
        tag_name: "choice",
        required_attributes: ["next", "text"],
        optional_attributes: ["onclick"],
        replacements: function (tag) {
            const attributes = get_attributes(tag, this);
            function get_result(page_available: boolean) {
                //next
                const result = createHTML(["a",
                    page_available
                        ? { class: "choice", href: `#${current_arc}/${attributes["next"].text}` }
                        : { class: "dead_choice" }]);
                //onclick
                if (attributes.onclick) {
                    const expression_context = run_parser(
                        {
                            code: attributes["onclick"].text,
                            evaluator: (parser) => parser.expression_(),
                        }
                    );
                    result.addEventListener("click", () => {
                        evaluate_expression(expression_context);
                        return true;
                    });
                }
                //text
                result.append(...attributes["text"].range);
                return new Tag_result(result);
            }
            switch (Page_checker.page_available(current_arc, attributes["next"].text)) {
                case Page_availability.Available:
                    return get_result(true);
                case Page_availability.Unavailable:
                    return get_result(false);
                case Page_availability.Unknown:
                    return Delayed_evaluation.evaluate((async () => {
                        return get_result(await Page_checker.fetch_page_available(current_arc, attributes["next"].text));
                    })(), attributes["text"]);
            }
        },
    },
    { //test
        tag_name: "test",
        required_attributes: ["text"],
        optional_attributes: [],
        replacements: function (tag) {
            const debug = false;
            const attributes = get_attributes(tag, this);
            if (debug) {
                for (const attribute in attributes) {
                    console.log(`Attribute "${attribute}" with value "${attributes[attribute].current_value}" and text "${attributes[attribute].text}"`);
                }
            }
            return new Tag_result(createHTML(["a", attributes["text"].text]));
        },
    },
    { //test delayed evaluation
        tag_name: "test_delayed_evaluation",
        required_attributes: [],
        optional_attributes: [],
        replacements: (tag) => {
            return Delayed_evaluation.evaluate((async () => new Tag_result("test_delayed_evaluation_result"))(), new Tag_result("test_delayed_evaluation_placeholder"));
        }
    },
    { //source
        tag_name: "source",
        required_attributes: [],
        optional_attributes: [],
        replacements: () => {
            const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`).replace(/#.*/, "");
            const html = new Tag_result(createHTML(["hr"]));
            html.append(createHTML(["a", { href: `${current_url}story arcs/${current_arc}/${current_scene}.txt` }, "Source"]));
            html.append(createHTML(["br"]));
            html.append(createHTML(["p", { class: "source" }, current_source]));
            return html;
        },
    },
    { //select
        tag_name: "select",
        required_attributes: [""],
        optional_attributes: [],
        replacements: (tag: Tag) => evaluate_select_tag(tag.ctx),
    },
    { //case
        tag_name: "case",
        required_attributes: [],
        optional_attributes: [],
        replacements: (tag: Tag) => { throw `"case" tag cannot be outside of "switch" tag` }
    },
] as const;

function html_comment(content: string) {
    return `<!-- ${content.replace(/-->/g, "~~>")} -->\n`;
}

function reduce<Key_type, Value_type, Accumulator_type>(map: Map<Key_type, Value_type>, reducer: { (current_value: Accumulator_type, key_value: [Key_type, Value_type]): Accumulator_type }, accumulator: Accumulator_type) {
    for (const key_value of map) {
        accumulator = reducer(accumulator, key_value);
    }
    return accumulator;
}

interface Evaluation_error_context {
    readonly start: { line: number, charPositionInLine: number };
    readonly sourceInterval: { length: number };
}
type Extends<Class, Interface, Message = ""> = Class extends Interface ? true : Message;
function static_assert<T extends true>() { }
static_assert<Extends<antlr4ts.ParserRuleContext, Evaluation_error_context, "antlr4ts.ParserRuleContext doesn't implement Evaluation_error_context anymore, need to change Evaluation_error_context so it does again">>();

interface Case_result {
    readonly applicable: boolean;
    readonly score: number;
    readonly priority: number;
    readonly text: Tag_result;
}

interface Case_code_result {
    readonly applicable: boolean;
    readonly score: number;
}

function throw_evaluation_error(error: string, context: Evaluation_error_context, source = current_source): never {
    const line = context.start.line;
    const character = context.start.charPositionInLine;
    const source_line = source.split('\n')[line - 1];
    function min(x: number, y: number) {
        return x < y ? x : y;
    }
    const length = min(context.sourceInterval.length, source_line.length - character);

    throw `Error evaluating source in line ${line}:\n`
    + `${source_line}\n`
    + `${" ".repeat(character) + "^" + (length > 1 ? "~".repeat(length - 1) : "")}\n`
    + error;
}

function evaluate_expression(expression: cyoaeParser.Expression_Context): Variable_storage_types | undefined {
    if (expression._operator) {
        switch (expression._operator.text) {
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
    } else if (expression._assignment) {
        const value = evaluate_expression(expression._expression);
        if (typeof value === "undefined") {
            throw_evaluation_error(`Cannot assign value "${expression._expression.text}" to variable "${expression._identifier.text}" because the expression does not evaluate to a value.`, expression);
        }
        Variable_storage.set_variable(expression._identifier.text, value);
    }
    else {
        if (expression._identifier) {
            const value = Variable_storage.get_variable(expression._identifier.text);
            if (typeof value === "undefined") {
                throw_evaluation_error(`Variable "${expression._identifier.text}" is undefined`, expression);
            }
            return value;
        }
        else if (expression._number) {
            return parseFloat(expression._number.text);
        }
        else if (expression._expression) {
            return evaluate_expression(expression._expression);
        }
        else if (expression._string) {
            return expression._string.text;
        }
        else if (expression._comparator) {
            const lhs = evaluate_expression(expression._left_expression);
            const rhs = evaluate_expression(expression._right_expression);
            if (typeof lhs === "undefined") {
                throw_evaluation_error(`Failed evaluating expression because ${expression._left_expression.text} is undefined`, expression._left_expression);
            }
            if (typeof rhs === "undefined") {
                throw_evaluation_error(`Failed evaluating expression because ${expression._right_expression.text} is undefined`, expression._right_expression);
            }
            function get_operator() {
                switch (expression._comparator.text) {
                    case "==":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs === rhs;
                    case "!=":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs !== rhs;
                    case "<=":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs <= rhs;
                    case ">=":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs >= rhs;
                    case "<":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs < rhs;
                    case ">":
                        return (lhs: Variable_storage_types, rhs: Variable_storage_types) => lhs > rhs;
                    default:
                        throw_evaluation_error(`Invalid operator ${expression._comparator.text}`, expression._comparator);
                }
            }
            if (typeof lhs === typeof rhs) {
                return get_operator()(lhs, rhs);
            }
            else {
                throw_evaluation_error(`Cannot compare ${lhs} of type ${typeof lhs} with ${rhs} of type ${typeof rhs}`, expression);
            }
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

function evaluate_tag(tag: Tag): Tag_result {
    const debug = false;
    debug && console.log(`Executing tag "${tag.name}" with value "${tag.default_value?.current_value}" and attributes [${tag.attributes.length > 0
        ? tag.attributes.reduce((curr, [attribute_name, attribute_value]) => `${curr}\t${attribute_name}="${attribute_value.current_value}"\n`, "\n")
        : ""
        }]\n`);
    const replacement = replacements.find((repl) => repl.tag_name === tag.name);
    if (replacement === undefined) {
        throw_evaluation_error(`Unknown tag "${tag.name}"`, tag.ctx);
    }
    //check that there are no duplicate attributes
    {
        let attribute_names = new Set<string>();
        for (const [attribute_name,] of tag.attributes) {
            if (attribute_names.has(attribute_name)) {
                throw_evaluation_error(`Found duplicate attribute ${attribute_name} in tag ${tag.name} which doesn't support that`, tag.ctx);
            }
            attribute_names.add(attribute_name);
        }
    }

    //TODO: Check that replacement.required_attributes are there

    //handle default value
    if (tag.default_value) {
        if (replacement.required_attributes.length === 0) {
            throw_evaluation_error(`Tag "${tag.name}" does not take arguments`, tag.ctx);
        }
        for (const attribute of tag.attributes) {
            if (attribute[0] === replacement.required_attributes[0]) {
                throw_evaluation_error(`Attribute "${attribute[0]}" of tag "${tag.name}" has been specified both as the default value and explicitly`, tag.ctx);
            }
        }
        tag.attributes.push([replacement.required_attributes[0], tag.default_value]);
    }
    try {
        return replacement.replacements(tag);
    }
    catch (error) {
        throw_evaluation_error(`${error}`, tag.ctx);
    }
}

function evaluate_richtext(ctx: cyoaeParser.Rich_text_Context): Tag_result {
    const debug = false;
    debug && console.log(`Evaluating richtext "${ctx.text}"`);
    let result = new Tag_result("");
    for (let i = 0; i < ctx.childCount; i++) {
        const child = ctx.getChild(i);
        debug && console.log(`Tag child ${i}: >>>${child.text}<<< with current text "${result.current_value}"`);
        if (child instanceof cyoaeParser.Plain_text_Context) {
            debug && console.log(`found plaintext "${child.text}"`);
            for (let i = 0; i < child.childCount; i++) {
                const grandchild = child.getChild(i);
                if (grandchild instanceof cyoaeParser.Escaped_text_Context) {
                    if (grandchild.text.length !== 2) {
                        throw_evaluation_error(`Invalid escape sequence: ${grandchild.text}`, grandchild);
                    }
                    result = result.append(grandchild.text[1]); //cut off the \
                }
                else {
                    result = result.append(grandchild.text);
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
                    tag.default_value = new Tag_result(ctx._default_value);
                }

                for (let i = 0; i < ctx.childCount; i++) {
                    const child = ctx.getChild(i);
                    if (child instanceof cyoaeParser.Attribute_Context) {
                        let attribute = tag.attributes.find(attrib => attrib[0] === child._attribute_name.text);
                        if (attribute) {
                            attribute[1] = attribute[1].append(new Tag_result(child._attribute_value));
                            debug && console.log(`Found addition attribute child for attribute ${child._attribute_name.text} with value ${child._attribute_value.text}. Full value: ${attribute[1].current_value}`);
                        }
                        else {
                            debug && console.log(`Found first attribute child for attribute ${child._attribute_name.text} with value ${child._attribute_value.text}`);
                            tag.attributes.push([child._attribute_name.text, new Tag_result(child._attribute_value)]);
                        }
                    }
                }
                return tag;
            }
            result = result.append(evaluate_tag(extract_tag(child)));
        }
        else if (child instanceof cyoaeParser.Code_Context) {
            debug && console.log(`Evaluating code "${child.text}"`);
            const value = evaluate_code(child);
            debug && console.log(`Result: "${value}"`);
            if (typeof value !== "undefined") {
                result = result.append(`${value}`);
            }
        }
        else if (child instanceof cyoaeParser.Number_Context) {
            debug && console.log(`Found number ${child.text}`);
            result = result.append(child.text);
        }
        else {
            throw_evaluation_error(`Internal logic error: Found child that is neither a plain text nor a tag nor a number in rich text`, ctx);
        }
    }
    debug && console.log(`Tag execution result: "${result.current_value}" which is ${result.is_text_available ? "plaintext" : "html"}`);
    return result;
}

function evaluate_select_tag(ctx: cyoaeParser.Tag_Context): Tag_result {
    const debug = false;
    if (ctx._tag_name.text !== "select") {
        throw_evaluation_error(`Internal logic error: Evaluating "${ctx._tag_name.text}" as a "select" tag`, ctx);
    }
    if (ctx._attribute) {
        throw_evaluation_error(`The "select" tag may not have attributes`, ctx._attribute);
    }
    let cases: Case_result[] = [];
    for (let i = 0; i < ctx._default_value.childCount; i++) {
        const child = ctx._default_value.getChild(i);
        if (child instanceof cyoaeParser.Tag_Context) {
            if (child._tag_name.text !== "case") {
                throw_evaluation_error(`Syntax error in "switch" tag: Only "case" tags are allowed as direct children of "switch" tag`, child);
            }
            cases.push(evaluate_case(child));
        }
        else if (child instanceof cyoaeParser.Plain_text_Context) {
            if (child._escapes || child._word) {
                throw_evaluation_error(`Syntax error in "switch" tag: Unexpected tokens "${child.text}"`, child);
            }
            continue;
        }
        else {
            if (child instanceof antlr4ts.ParserRuleContext) {
                throw_evaluation_error(`Syntax error in "switch" tag: Unexpected tokens "${child.text}"`, child);
            }
            else {
                throw `Syntax error in "switch" tag: Unexpected tokens "${child.text}"`;
            }
        }
    }
    debug && console.log(`All found cases: ${cases.reduce((curr, case_) => `${curr}\nApplicable: ${case_.applicable}, Score: ${case_.score}, Priority: ${case_.priority}, Text: ${case_.text.current_value}`, "")}`);
    cases = cases.filter(case_ => case_.applicable);
    debug && console.log(`Applicable cases: ${cases.reduce((curr, case_) => `${curr}\nApplicable: ${case_.applicable}, Score: ${case_.score}, Priority: ${case_.priority}, Text: ${case_.text.current_value}`, "")}`);
    const max_score = cases.reduce((curr, case_) => case_.score > curr ? case_.score : curr, 0);
    debug && console.log(`Max score: ${max_score}`);
    cases = cases.filter(case_ => case_.score === max_score);
    debug && debug && console.log(`Max score cases: ${cases.reduce((curr, case_) => `${curr}\nApplicable: ${case_.applicable}, Score: ${case_.score}, Priority: ${case_.priority}, Text: ${case_.text.current_value}`, "")}`);
    const total_priority = cases.reduce((curr, case_) => curr + case_.priority, 0);
    debug && console.log(`Total priority: ${total_priority}`);
    if (cases.length === 0) {
        return new Tag_result("");
    }
    if (cases.length === 1) {
        return cases[0].text;
    }
    let choice = Math.random() * total_priority;
    for (const case_ of cases) {
        choice -= case_.priority;
        if (choice <= 0) {
            return case_.text;
        }
    }
    //this should be unreachable
    console.error(`Reached supposedly unreachable case choice`);
    return cases[0].text;
}

function evaluate_case_code(ctx: cyoaeParser.Case_code_Context): Case_code_result {
    const debug = false;
    debug && console.log(`Entered case code evaluation with "${ctx.childCount}" expressions to evaluate`);
    let result = { applicable: true, score: 0 };
    for (let i = 0; i < ctx.childCount; i++) {
        const child = ctx.getChild(i);
        if (child instanceof cyoaeParser.Expression_Context) {
            debug && console.log(`Evaluating case condition ${child.text}`);
            try {
                const value = evaluate_expression(child);
                if (!value) {
                    result.applicable = false;
                }
            }
            catch (error) {
                if (`${error}`.search(/Variable "[^"]+" is undefined/) !== -1) {
                    result.applicable = false;
                }
                else {
                    throw error;
                }
            }
            result.score++;
        }
    }
    return result;
}

function evaluate_case(ctx: cyoaeParser.Tag_Context): Case_result {
    const debug = false;
    debug && console.log(`Evaluating case ${ctx.text}`);
    if (ctx._tag_name.text !== "case") {
        throw_evaluation_error(`Internal logic error: Evaluating "${ctx._tag_name.text}" as a "case" tag`, ctx);
    }
    let result = {
        applicable: true,
        score: 0,
        priority: 1,
        text: null as unknown as Tag_result,
    };
    for (let i = 0; i < ctx.childCount; i++) {
        const child = ctx.getChild(i);
        if (child instanceof cyoaeParser.Attribute_Context) {
            debug && console.log(`Found "${child._attribute_name.text}" attribute with value "${child._attribute_value.text}"`);
            switch (child._attribute_name.text) {
                case "text":
                    result.text = new Tag_result(child._attribute_value);
                    break;
                case "condition":
                    try {
                        const case_code_result = run_parser({
                            code: child._attribute_value.text,
                            filename: `Expression in ${child.start.line}:${child.start.charPositionInLine}`,
                            evaluator: parser => evaluate_case_code(parser.case_code_())
                        });
                        result.applicable = result.applicable && case_code_result.applicable;
                        result.score += case_code_result.score;
                    }
                    catch (err) {
                        throw_evaluation_error(`Failed evaluating condition: ${err}`, child._attribute_value);
                    }
                    break;
                case "priority":
                    try {
                        const text = evaluate_richtext(child._attribute_value).text;
                        const priority = parseFloat(text);
                        if (Number.isNaN(priority)) {
                            throw "NaN";
                        }
                        if (priority < 0) {
                            throw "Priority cannot be negative";
                        }
                        result.priority = priority;
                    }
                    catch (err) {
                        throw_evaluation_error(`Attribute "${child._attribute_name}" did not evaluate to a number: ${err}`, child._attribute_name);
                    }
                    break;
                default:
                    throw_evaluation_error(`Unknown attribute "${child._attribute_name.text}" in tag "case"`, child._attribute_name);
            }
        }
    }
    if (!result.text) {
        result.text = new Tag_result(ctx._default_value);
    }
    debug && console.log(`Result: applicable: ${result.applicable}, priority: ${result.priority}, score: ${result.score}, text: ${result.text.current_value}`);
    return result;
}

function run_parser<T>(parameters: {
    readonly code: string;
    readonly filename?: string;
    lexer_error_listener?: antlr4ts.ANTLRErrorListener<number>;
    parser_error_listener?: antlr4ts.ANTLRErrorListener<antlr4ts.Token>;
    evaluator: (parser: cyoaeParser.cyoaeParser) => T;
}) {
    const old_source = current_source;
    current_source = parameters.code;
    try {
        const input = antlr4ts.CharStreams.fromString(current_source, parameters.filename || "???");
        const lexer = new cyoaeLexer(input);
        const tokens = new antlr4ts.CommonTokenStream(lexer);
        const parser = new cyoaeParser.cyoaeParser(tokens);

        parameters.parser_error_listener = parameters.parser_error_listener || new ParserErrorListener(parser);
        parameters.lexer_error_listener = parameters.lexer_error_listener || new LexerErrorListener();

        lexer.removeErrorListeners();
        lexer.addErrorListener(parameters.lexer_error_listener);
        parser.removeErrorListeners();
        parser.addErrorListener(parameters.parser_error_listener);

        return parameters.evaluator(parser);
    }
    finally {
        current_source = old_source;
    }
}

function parse_source_text(data: string, filename: string) {
    console.log(`Starting parsing source text ${filename}`);
    return run_parser({
        code: data,
        filename: filename,
        evaluator: parser => {
            const tree = parser.start_();
            if (tree._rich_text) {
                return evaluate_richtext(tree._rich_text);
            }
            //TODO: Put up a proper placeholder page for an empty source
            return new Tag_result(`Empty file "${filename}"`);
        }
    });
}

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/start`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    const debug = false;
    debug && console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        Variable_storage.set_internal("current_scene", `${current_arc}/${current_scene}`);
        const story_container = createHTML(["div", { class: "main" }]);
        story_container.append(...parse_source_text(await download(`${current_arc}/${current_scene}.txt`), `${current_arc}/${current_scene}.txt`).range);
        const debug_container = createHTML(["div", { class: "debug" }]);
        const debug_button = createHTML(["button", "🐛"]);
        const variable_table = createHTML(["div"]);
        variable_table.append(createHTML(["hr"]), create_variable_table());
        debug_container.append(debug_button);
        debug_button.onclick = () => {
            if (debug_container.contains(variable_table)) {
                debug_container.removeChild(variable_table);
            }
            else {
                debug_container.append(variable_table);
            }
        };
        document.body.textContent = "";
        document.body.append(story_container, debug_container);
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}

async function url_hash_change() {
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
    document.body.append(createHTML(["span", { class: 'error' }, error]));
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

function assert_equal(actual: any, expected: any, explanation?: any) {
    function throw_error() {
        const details = `\n  Actual: "${actual}"\nExpected: "${expected}"`;
        const source = ` in ${(new Error()).stack?.split("\n")[1]}`;
        if (explanation) {
            throw `Assertion fail${source}:${details}${explanation ? "\n" + explanation : ""}`;
        }
        throw `Assertion fail${source}: ${details}`;
    }
    if (Array.isArray(actual) && Array.isArray(expected)) {
        if (actual.length !== expected.length) {
            throw_error();
        }
        for (const i in actual) {
            try {
                assert_equal(actual[i], expected[i])
            }
            catch (err) {
                explanation = `${err}\n${explanation}`;
                throw_error();
            }
            return;
        }
    }
    if (actual !== expected) {
        throw_error();
    }
}

async function tests() {
    function test_HTMLElement_to_string() {
        const element = document.createElement("p");
        assert_equal(HTMLElement_to_string(element), "<p></p>", `test_HTMLElement_to_string <p> tag`);
        element.append("TestText");
        assert_equal(HTMLElement_to_string(element), "<p>TestText</p>", `test_HTMLElement_to_string <p> tag with text "TestText"`);
        const span = document.createElement("span");
        element.append(span);
        assert_equal(HTMLElement_to_string(element), "<p>TestText<span></span></p>", `test_HTMLElement_to_string <p> tag with text "TestText" and <span> tag`);
        span.append("span text");
        assert_equal(HTMLElement_to_string(element), "<p>TestText<span>span text</span></p>", `test_HTMLElement_to_string <p> tag with text "TestText" and <span> tag`);
    }
    test_HTMLElement_to_string();

    function test_creatHTML() {
        assert_equal(HTMLElement_to_string(createHTML(["p", "test", "bla", "blup"])), "<p>testblablup</p>");
        assert_equal(HTMLElement_to_string(createHTML(["p", { class: "foo" }, "test", "bla", "blup"])), '<p class="foo">testblablup</p>');
        assert_equal(HTMLElement_to_string(createHTML(["p", { class: "foo" }, ["a", { href: "inter.net" }, "link"]])), '<p class="foo"><a href="inter.net">link</a></p>');
    }
    test_creatHTML();

    function test_Tag_result() {
        let text = new Tag_result("111");
        assert_equal(text.text, "111", "Initializing text failed");
        text = text.append("222");
        assert_equal(text.text, "111222", "Appending text failed");
        assert_equal(text.range.join(), "111222");
    }
    test_Tag_result();

    function test_tag_parsing() {
        let result = parse_source_text("[test {text:test1}]", "test_tag_parsing");
        let expected = new Tag_result(createHTML(["a", "test1"]));
        assert_equal(result.current_value, expected.current_value, `Checking test tag 1.`);

        result = parse_source_text("[test {text:test1}]", "test_tag_parsing");
        expected = new Tag_result(createHTML(["a", "test1"]));
        assert_equal(result.current_value, expected.current_value, `Checking test tag 2.`);

        result = parse_source_text("[test {text:test1}][test {text:test2}]", "test_tag_parsing");
        expected = new Tag_result([createHTML(["a", "test1"]), createHTML(["a", "test2"])]);
        assert_equal(result.current_value, expected.current_value, `Checking test tag 3.`);
    }
    test_tag_parsing();

    async function test_delayed_evaluation() {
        const debug = false;
        const result = parse_source_text("[test_delayed_evaluation]", "test_delayed_evaluation").current_value;
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
            run_parser({
                code: code,
                filename: `code evaluation test "${code}"`,
                evaluator: parser => {
                    assert_equal(evaluate_expression(parser.expression_()), expected, `for code "${code}"`);
                }
            });
        }
        test_eval("x=42");
        test_eval("x", 42);
        test_eval("x + 27", 69);
        test_eval("1+2*3", 7);
        test_eval("(1+2)*3", 9);
        try {
            test_eval("1/0");
            assert(false, `Zero division error did not produce exception`);
        } catch (e) { }
        Variable_storage.delete_variable("x");
    }
    test_code_evaluation();

    function test_game_variables() {
        assert_equal(typeof Variable_storage.get_variable("internal test variable"), "undefined");
        Variable_storage.set_variable("internal test variable", "yo");
        assert_equal(typeof Variable_storage.get_variable("internal test variable"), "string");
        assert_equal(Variable_storage.get_variable("internal test variable"), "yo");
        Variable_storage.set_variable("internal test variable", 42);
        assert_equal(typeof Variable_storage.get_variable("internal test variable"), "number");
        assert_equal(Variable_storage.get_variable("internal test variable"), 42);
        Variable_storage.set_variable("internal test variable", true);
        assert_equal(typeof Variable_storage.get_variable("internal test variable"), "boolean");
        assert_equal(Variable_storage.get_variable("internal test variable"), true);
        Variable_storage.delete_variable("internal test variable");
        assert_equal(typeof Variable_storage.get_variable("internal test variable"), "undefined");
    }
    test_game_variables();

    document.body.innerHTML = "";
}

// script entry point, loading the correct state and displays errors
async function main() {
    Variable_storage.init();
    try {
        await tests();
    }
    catch (err) {
        console.error(`Test failed: ${err}`);
        return;
    }
    try {
        const value = Variable_storage.get_internal_string("current_scene");
        if (value) {
            window.location.hash = `#${value}`;
        }
        else {
            await play_arc("intro");
        }
        await url_hash_change();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();