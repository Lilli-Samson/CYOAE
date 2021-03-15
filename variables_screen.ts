import {Variable_storage, Variable_storage_types} from './storage';

export function create_variable_screen(): string {
    let result = `
<table class="variables_screen" style="width:100%">
    <tr>
        <th>Variable</th>
        <th>Value</th>
        <th>Type</th>
    </tr>`;
    for (const [name, value] of Variable_storage.variables) {
        result += `
    <tr>
    <td contenteditable="true">${name}</td>
    <td contenteditable="true">${value}</td>
    <td>
        <select>
            <option value="string"${typeof value === "string" ? ' selected="true"' : ""}>String</option>
            <option value="number"${typeof value === "number" ? ' selected="true"' : ""}>Number</option>
            <option value="boolean"${typeof value === "boolean" ? ' selected="true"' : ""}>Boolean</option>
        </select>
    </td>
    </tr>`;
    }
    return `${result}\n</table>\n`;
}