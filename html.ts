type Tag_name = string;
type Attributes = {[key: string]: string};
type HTML_node = [Tag_name, ...(HTML_node | string | Attributes)[]];

export function createHTML(node: HTML_node): HTMLElement {
    const element = document.createElement(node[0]);
    function handle(parameter: Attributes | HTML_node | string) {
        if (typeof parameter === "string") {
            element.append(parameter);
        }
        else if (Array.isArray(parameter)) {
            element.append(createHTML(parameter));
        }
        else {
            for (const key in parameter) {
                element.setAttribute(key, parameter[key]);
            }
        }
    }
    for (let i = 1; i < node.length; i++) {
        handle(node[i]);
    }
    return element;
}
