"use strict";
console.log("Started");

async function play_arc(name) {
    const data = await get(`story arcs/${name}/start.txt`);
    document.body.innerHTML = process(data);
}

function escape(/** @type {String} */ string) {
    let element = document.createElement('p');
    element.innerText = string;
    return element.innerHTML;
}

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

function process(/** @type {String} */ source) {
    const result = source.replace(/\[\s*([^\]]*)\s*\]/, (_, /** @type {String} */ code) => {
        const [, tag, params] = code.match(/(\S*)\s*(.*)/);
        switch (tag.toLowerCase()) {
            case "img":
                console.log("img");
            case "image":
                console.log("image");
                return `<img src="${params}">`;
            default:
                console.log("default");
                throw `Unknown tag "${tag}"`;
        }
    });
    return result;
}

async function main() {
    try {
        await play_arc("intro");
    }
    catch (err) {
        document.body.innerHTML = `${err}`;
    }
}
main();