"use strict";

const antlr4 = require("antlr4/index");
const parser = require("grammar/cyoaeParser");

let current_arc = "";
let current_scene = "";

// executes [] tags
let execute_tag = async function execute_tag(code: string) {
    const [, tag, params] = code.match(/\s*(\S+)(?:\s+(.*))?/s) || [];
    const attributes = parse_attributes(params || "");
    function assert_correct_attributes(tag: string, valid_attributes: {required: string[], optional: string[]}) {
        for (const attribute of Object.keys(attributes)) {
            if (!new Set<string>(valid_attributes.required).has(attribute) && !new Set(valid_attributes.optional).has(attribute)) {
                throw `Invalid attribute "${attribute}" in tag "${tag}"`;
            }
        }
        for (const required of valid_attributes.required) {
            if (!(required in attributes)) {
                throw `Missing required attribute "${required}" in tag "${tag}"`;
            }
        }
    }
    let result = "";
    switch (tag.toLowerCase()) {
        case "img":
        case "image":
            assert_correct_attributes(tag, {required: ["url"], optional: []});
            result += "<img";
            for (const attribute of Object.keys(attributes)) {
                const value = attributes[attribute];
                switch (attribute) {
                    case "url":
                        result += ` src="${value}"`;
                        break;
                }
            }
            return result + ">";
        case "choice":
            assert_correct_attributes(tag, {required: ["next", "text"], optional: ["onselect"]});
            try {
                await get(attributes.next + ".txt");
                return `<a class="choice" href="#${current_arc}/${attributes.next}">${attributes.text}</a>`;
            }
            catch (err) {
                return `<a class="dead_choice" title="Failed loading ${current_arc}/${attributes.next}\n${err}">${attributes.text}</a>`;
            }
        case "source":
            assert_correct_attributes(tag, {required: [], optional: []});
            return `<hr><h3><a href="story arcs/${current_arc}/${current_scene}.txt">Source</a></h3><p class="source">${escape_html(await get(current_scene + ".txt"))}</p>`;
        case "code":
            assert_correct_attributes(tag, {required: [], optional: ["text"]});
            if ("text" in attributes && "" in attributes) {
                throw `Cannot have tag and default text in code tag.\nDefault text:\n${attributes[""]}\nText attribute:\n${attributes.text}`;
            }
            return `<a class="code">${escape_html(attributes.text || attributes[""])}</a>`;
    }
    throw `Unknown tag "${tag}"`;
}

interface Tag_attribute_value {
    value: string,
    rest: string
}

// parses attribute values, returning the value and the rest
function split_attribute_value(code: string): Tag_attribute_value {
    let depth = 0;
    let value = "";
    for (const character of code) {
        switch (character) {
            case  "[":
                depth++;
                break;
            case "]":
                if (depth === 0) {
                    throw `found unescaped "]" in attribute value`;
                }
                depth--;
                break;
            case "=":
                if (depth === 0) {
                    const match = value.match(/^(.*)\s\S+$/s) || [];
                    if (match.length !== 0) {
                        //found the next attribute
                        return {value: match[1], rest: code.slice(match[1].length + 1)}
                    }
                }
                break;
        }
        value += character;
    }
    return {value: value, rest: ""};
}

interface Tag_attribute {
    name: string,
    value: string
}

// parses tag parameters
function parse_attributes(code: string): {[key: string]: string} {
    if (/\s*[^\s=]+=/.test(code)) {
        //started out with an attribute
        return parse_following_attributes(code);
    }
    //started out with the default value
    const split = split_attribute_value(code);
    let result = split.rest ? parse_following_attributes(split.rest) : {};
    if (split.value) {
        result[""] = split.value;
    }
    return result;
}

function parse_following_attributes(code: string): {[key: string]: string} {
    code = code.trimLeft();
    if (code === "") {
        return {};
    }
    let [, attribute, rest] = code.match(/([^\s=]+)=(.*)/s) || [];
    if (!attribute) {
        throw `Failed finding attribute name of the form "attribute=value"`;
    }
    attribute = attribute.toLowerCase();
    const split = split_attribute_value(rest);
    let result = parse_following_attributes(split.rest);
    if (attribute in result) {
        throw `Found duplicate attribute "${attribute}"`;
    }
    result[attribute] = split.value;
    return result;
}

// plays through a story arc
async function play_arc(name: string) {
    window.location.hash = `#${name}/start`;
}

// display a scene based on a source .txt file and the current arc
async function update_current_scene() {
    console.log(`updating scene to ${current_arc}/${current_scene}`);
    try {
        const data = await get(`${current_scene}.txt`);
        document.body.innerHTML = await parse_source_text(data, `${current_scene}.txt`);
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

// parses source text files
async function parse_source_text(source: string, source_name: string) {
    let line = 1;
    let current_text = "";
    let tag_depth = 0; //number of encountered [s
    let result = "";
    let currently_escaping = false; //if we have just read a \
    function get_source_text(line: number) {
        return `In ${source_name} line ${line}:`;
    }
    for (const character of source) {
        //handle escaping
        if (currently_escaping) {
            switch (character) {
                case "[":
                case "]":
                case "\\":
                    current_text += character;
                    currently_escaping = false;
                    continue;
                default:
                    throw `${get_source_text(line)} Unexpected escape sequence "${"\\" + character}"`;
            }
        }
        else if (character === "\\") {
            currently_escaping = true;
            continue;
        }
        //handle parsing of regular text
        if (tag_depth === 0) {
            if (character === "[") {
                if (current_text) {
                    result += escape_html(current_text);
                    current_text = "";
                }
                tag_depth++;
                continue;
            }
            else if (character === "]") {
                throw `${get_source_text(line)} Unexpected closing tag "]". If you meant a literal "]" use "\\]".`;
            }
        }
        //handle parsing of [] tags
        else {
            if (character === "[") {
                tag_depth++;
            }
            else if (character === "]") {
                tag_depth--;
                if (tag_depth === 0) {
                    try {
                        result += await execute_tag(current_text);
                    }
                    catch (err) {
                        throw `${get_source_text(line)} ${err}`;
                    }
                    current_text = "";
                    continue;
                }
            }
        }
        //keep track of file position and content
        current_text += character;
        if (character === "\n") {
            line++;
        }
    }
    if (tag_depth !== 0) {
        throw `${get_source_text(line)} Opened tag with "[" but didn't close it with "]".`;
    }
    if (current_text) {
        result += escape_html(current_text);
    }
    return result;
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

// tests
async function run_tests() {
    function parse_tags_tests() {
        function assert_params(test_case: string, tags: {[key: string]: string}) {
            const attributes = parse_attributes(test_case);
            let details = "Expected:\n";
            for (const key of Object.keys(tags)) {
                details += `${key}: ${tags[key]}\n`;
            }
            details += "Actually:\n";
            for (const key of Object.keys(attributes)) {
                details += `${key}: ${attributes[key]}\n`;
            }
            for (const key of Object.keys(tags)) {
                if (!(key in attributes)) {
                    throw `Error in parsing test case\n${test_case}\n. Expected to find attribute "${key}" but didn't.\n${details}`;
                }
                if (tags[key] !== attributes[key]) {
                    throw `Error in parsing test case\n${test_case}\n. Value mismatch in tag "${key}".\n${details}`;
                }
            }
        }
        assert_params("", {});
        assert_params(" \t\n", {});
        assert_params("test=value", {test: "value"});
        assert_params("test= \t\nvalue", {test: " \t\nvalue"});
        assert_params("attribute=test [if a=42 b else c] bla bar=10", {attribute: "test [if a=42 b else c] bla", bar: "10"});
        assert_params("text=[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]",
            {text: "[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]"});
        console.log(parse_attributes("text=[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]"));
    }
    parse_tags_tests();
    async function parse_source_text_test() {
        const old_execute_tag = execute_tag;
        let tags: string[];
        execute_tag = async (str: string) => {
            tags.push(str);
            return "";
        }
        function test(source: string, ...expected_tags: string[]) {
            tags = [];
            parse_source_text(source, "test.txt");
            for (const index in tags) {
                if (arguments[Number(index) + 1] !== tags[Number(index)]) {
                    let err = `Failed parsing source "${source}" into appropriate tags.\n`;
                    err += `Expected:\n`;
                    for (const expected_tag of expected_tags) {
                        err += expected_tag + "\n";
                    }
                    err += `Actual:\n`;
                    for (const tag of tags) {
                        err += tag + "\n";
                    }
                    throw err;
                }
            }
        }
        test("[choice next=travel text=Leave the sword]", "choice next=travel text=Leave the sword");
        test("[code text=[choice next=travel text=Leave the sword]]", "code text=[choice next=travel text=Leave the sword]");
        test("[code bla test 42]", "code bla test 42");
        test("[code [inner tag=valid]]", "code [inner tag=valid]");
        execute_tag = old_execute_tag;
    }
    await parse_source_text_test();
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        await run_tests();
        await play_arc("intro");
        await url_hash_change();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();