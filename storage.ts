export type Variable_storage_types = number | string | boolean;

export class Variable_storage {
    private static debug = false;
    static init() {
        (window as any).gv = Variable_storage.get_variable;
        (window as any).sv = Variable_storage.set_variable;
        (window as any).dv = Variable_storage.delete_variable;
    }
    static get_variable(variable_name: string) {
        const stored = localStorage.getItem(variable_name);
        if (typeof stored !== "string") {
            Variable_storage.debug && console.log(`Getting variable "${variable_name}" (value: undefined)`);
            console.error(`Tried to fetch undefined variable ${variable_name}`);
            return;
        }
        Variable_storage.debug && console.log(`Getting variable "${variable_name}" with value: ${Variable_storage.string_to_value(stored)} (encoded: ${stored})`);
        return Variable_storage.string_to_value(stored);
    }
    static set_variable(variable_name: string, value: Variable_storage_types) {
        Variable_storage.debug && console.log(`Setting variable "${variable_name}" to value ${value} (encoded: ${Variable_storage.value_to_string(value)})`);
        localStorage.setItem(variable_name, Variable_storage.value_to_string(value));
        return true;
    }
    static delete_variable(variable_name: string) {
        Variable_storage.debug && console.log(`Deleting variable "${variable_name}"`);
        localStorage.removeItem(variable_name);
        return true;
    }
    static clear() {
        Variable_storage.debug && console.log(`Clearing all variables`);
        localStorage.clear();
    }
    static get variables() {
        let result = new Map<string, Variable_storage_types>();
        for (let i = 0; i < localStorage.length; i++) {
            const varname = localStorage.key(i);
            if (typeof varname !== "string") {
                throw `localStorage logic error: Failed finding key ${i}`;
            }
            const value = localStorage.getItem(varname);
            if (typeof value !== "string") {
                throw `localStorage logic error: Failed finding value for key ${varname}`;
            }
            result.set(varname, Variable_storage.string_to_value(value));
        }
        return result;
    }
    private static value_to_string(value: Variable_storage_types): string {
        switch (typeof value) {
            case "string":
                return `s${value}`;
            case "number":
                return `n${value}`;
            case "boolean":
                return value ? "b1" : "b0";
        }
    }
    private static string_to_value(str: string): Variable_storage_types {
        const type = str[0];
        const value = str.substring(1, str.length);
        switch (type) {
            case 's': //string
                return value;
            case 'n': //number
                return parseFloat(value);
            case 'b': //boolean
                return value === "1" ? true : false;
        }
        throw `invalid value: ${str}`;
    }
}