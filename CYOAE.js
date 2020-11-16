"use strict";
console.log("Started");

let current_arc_path = "";

//executes [] tags
async function execute_tag(/** @type {String} */ code) {
    const [, tag, params] = code.match(/\s*(\S*)\s*(.*)/s);
    console.log(`Executing tag "${tag}" with parameters "${params}".`);
    switch (tag.toLowerCase()) {
        case "img":
        case "image":
            return `<img src="${params}">`;
        case "choice":
            const [, scene, text] = params.match(/\s*(\S*)\s*(.*)/s);
            try {
                await get(scene + ".txt");
                return `<input id="choice" type="button" value="${text}" onclick="goto_scene('${scene}');" />`
            }
            catch (err) {
                return `<input id="dead_end" type="button" value="${text}" disabled />`
            }
    }
    throw `Unknown tag "${tag}"`;
}

// plays through a story arc
async function play_arc(/** @type {String} */ name) {
    current_arc_path = `story arcs/${name}/`
    await goto_scene("start");
}

//display a scene based on a source .txt file and the current arc
async function goto_scene(/** @type {String} */ scene) {
    try {
        const data = await get(`${scene}.txt`);
        document.body.innerHTML = await parse_source_text(data, `${scene}.txt`);
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}

// escapes HTML tags
function escape(/** @type {String} */ string) {
    console.log(`Escaping string ${string}`);
    let element = document.createElement('p');
    element.innerText = string;
    return element.innerHTML;
}

// downloads a local resource given its path/filename
async function get(/** @type {String} */ url) {
    const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`);
    const filepath = `${current_url}${current_arc_path}${url}`;
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
        const prev_char = current_text.slice(-1);
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
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();