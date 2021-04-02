type Tag_name = keyof HTMLElementTagNameMap;
type Attributes = {[key: string]: string};
type HTML_node<T extends Tag_name> = [T, ...(HTML_node<Tag_name> | HTMLElement | string | Attributes)[]];

export function createHTML<T extends Tag_name>(node: HTML_node<T>): HTMLElementTagNameMap[T] {
    const element = document.createElement(node[0]);
    function handle(parameter: Attributes | HTML_node<Tag_name> | HTMLElement | string) {
        if (typeof parameter === "string" || parameter instanceof HTMLElement) {
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
