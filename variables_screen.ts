import { createHTML } from './html';
import { Variable_storage, Variable_storage_types } from './storage';


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

    function add_row(name: string, value: Variable_storage_types) {
        const button = createHTML(["button", {class: "variable_delete"}, "🗑"]);
        const row = createHTML(
            ["tr",
                ["td", {contenteditable: "true"}, button, name],
                ["td", {contenteditable: "true"}, `${value}`],
                ["td",
                    ["select",
                        ["option", {value: "string"}, typeof value === "string" ? {selected: "true"} : {}, "String"],
                        ["option", {value: "number"}, typeof value === "number" ? {selected: "true"} : {}, "Number"],
                        ["option", {value: "boolean"}, typeof value === "boolean" ? {selected: "true"} : {}, "Boolean"],
                    ]
                ],
            ]
        );
        button.addEventListener("click", () => {
            Variable_storage.delete_variable(name);
            table.removeChild(row);
        });
        table.append(row);
    }

    for (const [name, value] of Variable_storage.variables) {
        add_row(name, value);
    }
    const add_var_button = createHTML(["button", {class: "variable_add"}, "+"]);
    add_var_button.addEventListener("click", () => {
        table.removeChild(add_var_button);
        add_row("", "");
        table.append(add_var_button);
    });
    table.append(add_var_button);
    return table;
}
