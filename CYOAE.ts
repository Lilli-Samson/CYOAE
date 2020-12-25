"use strict";

const antlr4 = require("antlr4/index");
const cyoaeLexer = require("./cyoaeLexer");
const cyoaeParser = require("./cyoaeParser");
let cyoaeListener = require("./cyoaeListener").cyoaeListener;

let current_arc = "";
let current_scene = "";

function output(text: string) {
    document.body.innerHTML += text;
}

class Listener extends cyoaeListener {
    exitTag(ctx: any) {
        console.log("Exited Tag");
    }
}

async function parse_source_text(data: string, filename: string) {
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
        const data = await get(`${current_scene}.txt`);
        await parse_source_text(data, `${current_scene}.txt`);
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