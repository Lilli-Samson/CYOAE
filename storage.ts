export type Variable_storage_types = number | string | boolean;

function variable_to_string(value: Variable_storage_types): string {
    switch (typeof value) {
        case "string":
            return `s${value}`;
        case "number":
            return `n${value}`;
        case "boolean":
            return value ? "b1" : "b0";
    }
}
function string_to_variable(vv: string): Variable_storage_types {
    const prefix = vv[0];
    const value = vv.substring(1);
    switch (prefix) {
        case 's': //string
            return value;
        case 'n': //number
            return parseFloat(value);
        case 'b': //boolean
            return value === "1" ? true : false;
    }
    throw `invalid value: ${vv}`;
}

export class Variable_storage {
    private static debug = false;
    static init() {
        (window as any).gv = Variable_storage.get_variable;
        (window as any).sv = Variable_storage.set_variable;
        (window as any).dv = Variable_storage.delete_variable;
    }
    static get_variable(variable_name: string) {
        const stored = localStorage.getItem(`v${variable_name}`);
        if (typeof stored !== "string") {
            Variable_storage.debug && console.log(`Getting variable "${variable_name}" (value: undefined)`);
            console.error(`Tried to fetch undefined variable ${variable_name}`);
            return;
        }
        Variable_storage.debug && console.log(`Getting variable "${variable_name}" with value: ${string_to_variable(stored)} (encoded: ${stored})`);
        return string_to_variable(stored);
    }
    static set_variable(variable_name: string, value: Variable_storage_types) {
        Variable_storage.debug && console.log(`Setting variable "${variable_name}" to value ${value} (encoded: ${variable_to_string(value)})`);
        localStorage.setItem(`v${variable_name}`, variable_to_string(value));
        return true;
    }
    static delete_variable(variable_name: string) {
        Variable_storage.debug && console.log(`Deleting variable "${variable_name}"`);
        localStorage.removeItem(`v${variable_name}`);
        return true;
    }
    static get_internal(internal_name: string) {
        const stored = localStorage.getItem(`i${internal_name}`);
        if (typeof stored !== "string") {
            Variable_storage.debug && console.log(`Getting internal "${internal_name}" (value: undefined)`);
            console.error(`Tried to fetch undefined internal ${internal_name}`);
            return;
        }
        Variable_storage.debug && console.log(`Getting internal "${internal_name}" with value: ${string_to_variable(stored)} (encoded: ${stored})`);
        return string_to_variable(stored);
    }
    static set_internal(internal_name: string, value: Variable_storage_types) {
        Variable_storage.debug && console.log(`Setting internal "${internal_name}" to value ${value} (encoded: ${variable_to_string(value)})`);
        localStorage.setItem(`i${internal_name}`, variable_to_string(value));
        return true;
    }
    static delete_internal(internal_name: string) {
        Variable_storage.debug && console.log(`Deleting internal "${internal_name}"`);
        localStorage.removeItem(`i${internal_name}`);
        return true;
    }
    static clear_all() {
        Variable_storage.debug && console.log(`Clearing all variables and internals`);
        localStorage.clear();
    }
    static get variables() {
        let result = new Map<string, Variable_storage_types>();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (typeof key !== "string") {
                throw `localStorage logic error: Failed finding key ${i}`;
            }
            if (!(key[0] === "v")) { //not a variable
                continue;
            }
            const value = localStorage.getItem(key);
            if (typeof value !== "string") {
                throw `localStorage logic error: Failed finding value for key ${key}`;
            }
            result.set(key.substr(1), string_to_variable(value));
        }
        return result;
    }
}