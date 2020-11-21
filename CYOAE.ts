"use strict";

let current_arc = "";
let current_scene = "";

//executes [] tags
async function execute_tag(code: string) {
    const [, tag, params] = code.match(/\s*(\S+)(?:\s+(.*))?/s) || [];
    //\s*(\S+)=((?:(?!\s+\S+=).)+)
    switch (tag.toLowerCase()) {
        case "img":
        case "image":
            return `<img src="${params}">`;
        case "choice":
            const [, scene, text] = params.match(/\s*(\S*)\s*(.*)/s) || [];
            try {
                await get(scene + ".txt");
                return `<a class="choice" href="#${current_arc}/${scene}">${text}</a>`;
            }
            catch (err) {
                return `<a class="dead_choice" title="Failed loading ${current_arc}/${scene}\n${err}">${text}</a>`;
            }
        case "source":
            return `<h3><a href="story arcs/${current_arc}/${current_scene}.txt">Source</a></h3><p class="source">${escape_html(await get(current_scene + ".txt"))}</p>`;
    }
    throw `Unknown tag "${tag}"`;
}

//parses tag parameters
function parse_tags(code: string) {
    
}

// plays through a story arc
async function play_arc(name: string) {
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

//parses source text files
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
        result += escape_html(current_text);
    }
    return result;
}

function display_error_document(error: string) {
    document.body.innerHTML = escape_html(`Error: ${error}`);
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