"use strict";

let current_arc = "";
let current_scene = "";

//executes [] tags
async function execute_tag(/** @type {String} */ code) {
    const [, tag, params] = code.match(/\s*(\S*)\s*(.*)/s);
    switch (tag.toLowerCase()) {
        case "img":
        case "image":
            return `<img src="${params}">`;
        case "choice":
            const [, scene, text] = params.match(/\s*(\S*)\s*(.*)/s);
            try {
                await get(scene + ".txt");
                return `<input id="choice" type="button" value="${text}" onclick="window.location.hash = '#${current_arc}/${scene}'" />`
            }
            catch (err) {
                return `<input id="dead_end" type="button" value="${text}" disabled />`
            }
    }
    throw `Unknown tag "${tag}"`;
}

// plays through a story arc
async function play_arc(/** @type {String} */ name) {
    window.location.hash = `#${name}/start`;
}

//display a scene based on a source .txt file and the current arc
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

async function hash_change() {
    const [, arc, scene] = window.location.hash.match(/#([^\/]*)\/(.*)/);
    current_arc = arc;
    current_scene = scene;
    await update_current_scene();
}

window.onhashchange = hash_change;

// escapes HTML tags
function escape(/** @type {String} */ string) {
    let element = document.createElement('p');
    element.innerText = string;
    return element.innerHTML;
}

// downloads a local resource given its path/filename
async function get(/** @type {String} */ url) {
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

//parses source text files
async function parse_source_text(/** @type {String} */ source, /** @type {String} */ source_name) {
    let line = 1;
    let current_text = "";
    let currently_parsing_text = true; //as opposed to a [tag]
    let result = "";
    let currently_escaping = false; //if we have just read a \
    function get_source_text(/** @type {Number} */ line) {
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
        if (currently_parsing_text) {
            if (character === "[") {
                if (current_text) {
                    result += escape(current_text);
                    current_text = "";
                }
                currently_parsing_text = false;
                continue;
            }
            else if (character === "]") {
                throw `${get_source_text(line)} Unexpected closing tag "]". If you meant a literal "]" use "\\]".`;
            }
        }
        //handle parsing of [] tags
        else {
            if (character === "]") {
                if (current_text) {
                    try {
                        result += await execute_tag(current_text);
                    }
                    catch (err) {
                        throw `${get_source_text(line)} ${err}`;
                    }
                    current_text = "";
                }
                currently_parsing_text = true;
                continue;
            }
        }
        //keep track of file position and content
        current_text += character;
        if (character === "\n") {
            line++;
        }
    }
    if (currently_parsing_text === false) {
        throw `${get_source_text(line)} Opened tag with "[" but didn't close it with "]".`;
    }
    if (current_text) {
        result += escape(current_text);
    }
    return result;
}

function display_error_document(/** @type {String} */ error) {
    document.body.innerHTML = escape(`Error: ${error}`);
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        await play_arc("intro");
        await hash_change();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();