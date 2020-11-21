"use strict";

let current_arc = "";
let current_scene = "";

//executes [] tags
async function execute_tag(/** @type {String} */ code) {
    const [, tag, params] = code.match(/\s*(\S+)(?:\s+(.*))?/s);
    //\s*(\S+)=((?:(?!\s+\S+=).)+)
    switch (tag.toLowerCase()) {
        case "img":
        case "image":
            return `<img src="${params}">`;
        case "choice":
            const [, scene, text] = params.match(/\s*(\S*)\s*(.*)/s);
            try {
                await get(scene + ".txt");
                return `<a class="choice" href="#${current_arc}/${scene}">${text}</a>`;
            }
            catch (err) {
                return `<a class="dead_choice" title="Failed loading ${current_arc}/${scene}\n${err}">${text}</a>`;
            }
        case "source":
            return `<h3><a href="story arcs/${current_arc}/${current_scene}.txt">Source</a></h3><p class="source">${escape(await get(current_scene + ".txt"))}</p>`;
    }
    throw `Unknown tag "${tag}"`;
}

//parses tag parameters
function parse_tags(/** @type {String} */ code) {
    
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

window.onhashchange = async () => {
    const [, arc, scene] = window.location.hash.match(/#([^\/]*)\/(.*)/);
    if (arc && scene) {
        current_arc = arc;
        current_scene = scene;
        await update_current_scene();
    }
}

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
    let tag_depth = 0; //number of encountered [s
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
        if (tag_depth === 0) {
            if (character === "[") {
                if (current_text) {
                    result += escape(current_text);
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
                }
                continue;
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
        await window.onhashchange();
    }
    catch (err) {
        display_error_document(`${err}`);
    }
}
main();