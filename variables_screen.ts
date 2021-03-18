import { createHTML } from './html';
import { Variable_storage } from './storage';

export function create_variable_table() {
    const table = createHTML(
        ["table", {class: "variables_screen", style: "width:100%"},
            ["tr", 
                ["th", "Variable"],
                ["th", "Value"],
                ["th", "type"],
            ]
        ]
    );
    for (const [name, value] of Variable_storage.variables) {
        table.append(createHTML(
            ["tr",
                ["td", {contenteditable: "true"}, ["button", {class: "variable_delete"}, "🗑"], name],
                ["td", {contenteditable: "true"}, `${value}`],
                ["td",
                    ["select",
                        ["option", {value: "string"}, typeof value === "string" ? {selected: "true"} : {}, "String"],
                        ["option", {value: "number"}, typeof value === "number" ? {selected: "true"} : {}, "Number"],
                        ["option", {value: "boolean"}, typeof value === "boolean" ? {selected: "true"} : {}, "Boolean"],
                    ]
                ],
            ]
        ));
    }
    return table;
}
