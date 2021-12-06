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
                ["th", "Type"],
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
        if (cell === table.rows[0].cells[0]) {
            return;
        }
        const var_name_cell = row.cells[1];
        if (var_name_cell.textContent === null) {
            return;
        }
        Variable_storage.delete_variable(var_name_cell.textContent);
        table.removeChild(row);
    });

    table.addEventListener("input", (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const row = target.parentElement;
        if (!(row instanceof HTMLTableRowElement)) {
            return;
        }
        save_row(row);
    });

    function save_row(row: HTMLTableRowElement) {
        const name = row.cells[1].textContent || "";
        const old_name = row.cells[1].dataset.old_name || "";
        const value = row.cells[2].textContent || "";
        const type_element = row.cells[3]?.children[0];
        if (!(type_element instanceof HTMLSelectElement)) {
            console.error(`found invalid row without select element`);
            return;
        }
        const type = type_element.selectedOptions[0].value;
        if (name !== old_name) {
            console.log(`Edited "${name}" (previously ${old_name}) = "${value}" (${type})`);
        }
        else {
            console.log(`Edited "${name}" = "${value}" (${type})`);
        }

        console.log(`Name: ${name}, Old name: ${old_name}`);
        if (name !== old_name && old_name) {
            if (Variable_storage.has_variable(name)) {
                row.cells[1].style.color = "#800";
                Variable_storage.set_variable(old_name, value);
            }
            else {
                row.cells[1].style.color = "#000";
                Variable_storage.delete_variable(old_name);
                Variable_storage.set_variable(name, value);
                row.cells[1].dataset.old_name = name;
            }
        }
        else {
            //overwrite existing variable
            Variable_storage.set_variable(name, value);
            row.cells[1].dataset.old_name = name;
        }
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
