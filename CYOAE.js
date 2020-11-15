"use strict";
console.log("Started");

// plays through a story arc
async function play_arc(name) {
    const data = await get(`story arcs/${name}/start.txt`);
    document.body.innerHTML = process(data);
}

// escapes HTML tags
function escape(/** @type {String} */ string) {
    let element = document.createElement('p');
    element.innerText = string;
    return element.innerHTML;
}

// downloads a local resource given its path/filename
async function get(/** @type {String} */ url) {
    const current_url = window.location.toString().replace(/\/[^\/]*$/, `/`);
    const filepath = `${current_url}${url}`;
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

//executes [] tags
function process(/** @type {String} */ source) {
    const result = source.replace(/\[\s*([^\]]*)\s*\]/, (_, /** @type {String} */ code) => {
        const [, tag, params] = code.match(/(\S*)\s*(.*)/);
        switch (tag.toLowerCase()) {
            case "img":
            case "image":
                return `<img src="${params}">`;
            default:
                throw `Unknown tag "${tag}"`;
        }
    });
    return result;
}

// script entry point, loading the correct state and displays errors
async function main() {
    try {
        await play_arc("intro");
    }
    catch (err) {
        document.body.innerHTML = `${err}`;
    }
}
main();