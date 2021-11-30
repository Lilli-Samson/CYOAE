import { createHTML } from './html';
import { Variable_storage, Variable_storage_types } from './storage';


export function create_variable_table() {
    const table = createHTML(
        ["table", { class: "variables_screen", style: "width:100%" },
            ["col", { style: "width:1em" }],
            ["col"],
            ["col"],
            ["tr",
                ["th", { colspan: "2", width: "1em" }, "Variable"],
                ["th", "Value"],
                ["th", "type"],
            ]
        ]
    );

    //Delete button for variables
    table.addEventListener("click", (event: MouseEvent) => {
        const cell = event.target;
        if (!(cell instanceof HTMLTableCellElement)) {
            return;
        }
        const row = cell.parentElement;
        if (!(row instanceof HTMLTableRowElement)) {
            return;
        }
        if (!(cell === row.cells[0])) {
            return;
        }
        const var_name_cell = row.cells[1];
        if (var_name_cell.textContent === null) {
            return;
        }
        if (var_name_cell.textContent !== "") {
            Variable_storage.delete_variable(var_name_cell.textContent);
        }
        table.removeChild(row);
    });

    table.addEventListener("input", (event: Event) => {
        //TODO
    });

    function save_row(row: number) {
        //TODO
    }

    function add_row(name: string, value: Variable_storage_types) {
        const row = createHTML(
            ["tr",
                ["td", { class: "unselectable" }, "🗑"],
                ["td", { contenteditable: "true" }, name],
                ["td", { contenteditable: "true" }, `${value}`],
                ["td",
                    ["select",
                        ["option", { value: "string" }, typeof value === "string" ? { selected: "true" } : {}, "String"],
                        ["option", { value: "number" }, typeof value === "number" ? { selected: "true" } : {}, "Number"],
                        ["option", { value: "boolean" }, typeof value === "boolean" ? { selected: "true" } : {}, "Boolean"],
                    ]
                ],
            ]
        );
        table.append(row);
    }

    for (const [name, value] of Variable_storage.variables) {
        add_row(name, value);
    }
    const add_var_button = createHTML(["button", { class: "variable_add" }, "+"]);
    add_var_button.addEventListener("click", () => {
        table.removeChild(add_var_button);
        add_row("", "");
        table.append(add_var_button);
    });
    table.append(add_var_button);
    return table;
}
