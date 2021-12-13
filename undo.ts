import { Variable_storage, Variable_storage_types } from './storage';

const last_values = new Map<string, Variable_storage_types>();

export function get_undo_update_code(old_values?: Map<string, Variable_storage_types>, new_values?: Map<string, Variable_storage_types>): string {
    if (!new_values) {
        new_values = Variable_storage.variables;
    }
    if (!old_values) {
        old_values = last_values;
    }
    let result = "";

    for (const [name, old_value] of old_values) {
        const new_value = new_values.get(name);
        if (new_value !== undefined) {
            if (new_value === old_value) {
                continue;
            }
            old_values.set(name, new_value);
        }
        else {
            old_values.delete(name);
        }
        if (typeof old_value === "string") {
            result += `${name}="${old_value}";`;
        }
        else {
            result += `${name}=${old_value};`;
        }
    }

    for (const [name,] of new_values) {
        if (old_values.get(name) === undefined) {
            result += `delete ${name};`;
        }
    }

    return result;
}
