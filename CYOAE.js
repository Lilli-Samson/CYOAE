"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
requirejs.config({
    baseUrl: 'antlr4',
});
//const antlr4 = await require(["antlr4/index"], function(antlr4_index) {});
//const parser = await require(["grammar/cyoaeParser"]);
require(["antlr4/index"]);
var current_arc = "";
var current_scene = "";
// executes [] tags
var execute_tag = function execute_tag(code) {
    return __awaiter(this, void 0, void 0, function () {
        function assert_correct_attributes(tag, valid_attributes) {
            for (var _i = 0, _a = Object.keys(attributes); _i < _a.length; _i++) {
                var attribute = _a[_i];
                if (!new Set(valid_attributes.required).has(attribute) && !new Set(valid_attributes.optional).has(attribute)) {
                    throw "Invalid attribute \"" + attribute + "\" in tag \"" + tag + "\"";
                }
            }
            for (var _b = 0, _c = valid_attributes.required; _b < _c.length; _b++) {
                var required = _c[_b];
                if (!(required in attributes)) {
                    throw "Missing required attribute \"" + required + "\" in tag \"" + tag + "\"";
                }
            }
        }
        var _a, tag, params, attributes, result, _b, _i, _c, attribute, value, err_1, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _a = code.match(/\s*(\S+)(?:\s+(.*))?/s) || [], tag = _a[1], params = _a[2];
                    attributes = parse_attributes(params || "");
                    result = "";
                    _b = tag.toLowerCase();
                    switch (_b) {
                        case "img": return [3 /*break*/, 1];
                        case "image": return [3 /*break*/, 1];
                        case "choice": return [3 /*break*/, 2];
                        case "source": return [3 /*break*/, 6];
                        case "code": return [3 /*break*/, 8];
                    }
                    return [3 /*break*/, 9];
                case 1:
                    assert_correct_attributes(tag, { required: ["url"], optional: [] });
                    result += "<img";
                    for (_i = 0, _c = Object.keys(attributes); _i < _c.length; _i++) {
                        attribute = _c[_i];
                        value = attributes[attribute];
                        switch (attribute) {
                            case "url":
                                result += " src=\"" + value + "\"";
                                break;
                        }
                    }
                    return [2 /*return*/, result + ">"];
                case 2:
                    assert_correct_attributes(tag, { required: ["next", "text"], optional: ["onselect"] });
                    _f.label = 3;
                case 3:
                    _f.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, get(attributes.next + ".txt")];
                case 4:
                    _f.sent();
                    return [2 /*return*/, "<a class=\"choice\" href=\"#" + current_arc + "/" + attributes.next + "\">" + attributes.text + "</a>"];
                case 5:
                    err_1 = _f.sent();
                    return [2 /*return*/, "<a class=\"dead_choice\" title=\"Failed loading " + current_arc + "/" + attributes.next + "\n" + err_1 + "\">" + attributes.text + "</a>"];
                case 6:
                    assert_correct_attributes(tag, { required: [], optional: [] });
                    _d = "<hr><h3><a href=\"story arcs/" + current_arc + "/" + current_scene + ".txt\">Source</a></h3><p class=\"source\">";
                    _e = escape_html;
                    return [4 /*yield*/, get(current_scene + ".txt")];
                case 7: return [2 /*return*/, _d + _e.apply(void 0, [_f.sent()]) + "</p>"];
                case 8:
                    assert_correct_attributes(tag, { required: [], optional: ["text"] });
                    if ("text" in attributes && "" in attributes) {
                        throw "Cannot have tag and default text in code tag.\nDefault text:\n" + attributes[""] + "\nText attribute:\n" + attributes.text;
                    }
                    return [2 /*return*/, "<a class=\"code\">" + escape_html(attributes.text || attributes[""]) + "</a>"];
                case 9: throw "Unknown tag \"" + tag + "\"";
            }
        });
    });
};
// parses attribute values, returning the value and the rest
function split_attribute_value(code) {
    var depth = 0;
    var value = "";
    for (var _i = 0, code_1 = code; _i < code_1.length; _i++) {
        var character = code_1[_i];
        switch (character) {
            case "[":
                depth++;
                break;
            case "]":
                if (depth === 0) {
                    throw "found unescaped \"]\" in attribute value";
                }
                depth--;
                break;
            case "=":
                if (depth === 0) {
                    var match = value.match(/^(.*)\s\S+$/s) || [];
                    if (match.length !== 0) {
                        //found the next attribute
                        return { value: match[1], rest: code.slice(match[1].length + 1) };
                    }
                }
                break;
        }
        value += character;
    }
    return { value: value, rest: "" };
}
// parses tag parameters
function parse_attributes(code) {
    if (/\s*[^\s=]+=/.test(code)) {
        //started out with an attribute
        return parse_following_attributes(code);
    }
    //started out with the default value
    var split = split_attribute_value(code);
    var result = split.rest ? parse_following_attributes(split.rest) : {};
    if (split.value) {
        result[""] = split.value;
    }
    return result;
}
function parse_following_attributes(code) {
    code = code.trimLeft();
    if (code === "") {
        return {};
    }
    var _a = code.match(/([^\s=]+)=(.*)/s) || [], attribute = _a[1], rest = _a[2];
    if (!attribute) {
        throw "Failed finding attribute name of the form \"attribute=value\"";
    }
    attribute = attribute.toLowerCase();
    var split = split_attribute_value(rest);
    var result = parse_following_attributes(split.rest);
    if (attribute in result) {
        throw "Found duplicate attribute \"" + attribute + "\"";
    }
    result[attribute] = split.value;
    return result;
}
// plays through a story arc
function play_arc(name) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            window.location.hash = "#" + name + "/start";
            return [2 /*return*/];
        });
    });
}
// display a scene based on a source .txt file and the current arc
function update_current_scene() {
    return __awaiter(this, void 0, void 0, function () {
        var data, _a, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log("updating scene to " + current_arc + "/" + current_scene);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, get(current_scene + ".txt")];
                case 2:
                    data = _b.sent();
                    _a = document.body;
                    return [4 /*yield*/, parse_source_text(data, current_scene + ".txt")];
                case 3:
                    _a.innerHTML = _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _b.sent();
                    display_error_document("" + err_2);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function url_hash_change() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, arc, scene;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = window.location.hash.match(/#([^\/]*)\/(.*)/) || [], arc = _a[1], scene = _a[2];
                    if (!(arc && scene)) return [3 /*break*/, 2];
                    current_arc = arc;
                    current_scene = scene;
                    return [4 /*yield*/, update_current_scene()];
                case 1:
                    _b.sent();
                    _b.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
window.onhashchange = url_hash_change;
// escapes HTML tags
function escape_html(str) {
    var element = document.createElement('p');
    element.innerText = str;
    return element.innerHTML;
}
// downloads a local resource given its path/filename
function get(url) {
    return __awaiter(this, void 0, void 0, function () {
        var current_url, filepath, request, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    current_url = window.location.toString().replace(/\/[^\/]*$/, "/").replace(/#.*/, "");
                    filepath = current_url + "story arcs/" + current_arc + "/" + url;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, fetch(filepath)];
                case 2:
                    request = _a.sent();
                    if (!request.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, request.text()];
                case 3: return [2 /*return*/, _a.sent()];
                case 4: throw request.statusText;
                case 5:
                    err_3 = _a.sent();
                    throw "Failed loading resource " + filepath + ": " + err_3;
                case 6: return [2 /*return*/];
            }
        });
    });
}
// parses source text files
function parse_source_text(source, source_name) {
    return __awaiter(this, void 0, void 0, function () {
        function get_source_text(line) {
            return "In " + source_name + " line " + line + ":";
        }
        var line, current_text, tag_depth, result, currently_escaping, _i, source_1, character, _a, err_4;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    line = 1;
                    current_text = "";
                    tag_depth = 0;
                    result = "";
                    currently_escaping = false;
                    _i = 0, source_1 = source;
                    _b.label = 1;
                case 1:
                    if (!(_i < source_1.length)) return [3 /*break*/, 10];
                    character = source_1[_i];
                    //handle escaping
                    if (currently_escaping) {
                        switch (character) {
                            case "[":
                            case "]":
                            case "\\":
                                current_text += character;
                                currently_escaping = false;
                                return [3 /*break*/, 9];
                            default:
                                throw get_source_text(line) + " Unexpected escape sequence \"" + ("\\" + character) + "\"";
                        }
                    }
                    else if (character === "\\") {
                        currently_escaping = true;
                        return [3 /*break*/, 9];
                    }
                    if (!(tag_depth === 0)) return [3 /*break*/, 2];
                    if (character === "[") {
                        if (current_text) {
                            result += escape_html(current_text);
                            current_text = "";
                        }
                        tag_depth++;
                        return [3 /*break*/, 9];
                    }
                    else if (character === "]") {
                        throw get_source_text(line) + " Unexpected closing tag \"]\". If you meant a literal \"]\" use \"\\]\".";
                    }
                    return [3 /*break*/, 8];
                case 2:
                    if (!(character === "[")) return [3 /*break*/, 3];
                    tag_depth++;
                    return [3 /*break*/, 8];
                case 3:
                    if (!(character === "]")) return [3 /*break*/, 8];
                    tag_depth--;
                    if (!(tag_depth === 0)) return [3 /*break*/, 8];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    _a = result;
                    return [4 /*yield*/, execute_tag(current_text)];
                case 5:
                    result = _a + _b.sent();
                    return [3 /*break*/, 7];
                case 6:
                    err_4 = _b.sent();
                    throw get_source_text(line) + " " + err_4;
                case 7:
                    current_text = "";
                    return [3 /*break*/, 9];
                case 8:
                    //keep track of file position and content
                    current_text += character;
                    if (character === "\n") {
                        line++;
                    }
                    _b.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 1];
                case 10:
                    if (tag_depth !== 0) {
                        throw get_source_text(line) + " Opened tag with \"[\" but didn't close it with \"]\".";
                    }
                    if (current_text) {
                        result += escape_html(current_text);
                    }
                    return [2 /*return*/, result];
            }
        });
    });
}
function display_error_document(error) {
    document.body.innerHTML = escape_html("Error: " + error);
}
function assert(predicate, explanation) {
    if (explanation === void 0) { explanation = ""; }
    if (!predicate) {
        if (explanation) {
            throw "Assertion fail: " + explanation;
        }
        throw "Assertion fail";
    }
}
// tests
function run_tests() {
    return __awaiter(this, void 0, void 0, function () {
        function parse_tags_tests() {
            function assert_params(test_case, tags) {
                var attributes = parse_attributes(test_case);
                var details = "Expected:\n";
                for (var _i = 0, _a = Object.keys(tags); _i < _a.length; _i++) {
                    var key = _a[_i];
                    details += key + ": " + tags[key] + "\n";
                }
                details += "Actually:\n";
                for (var _b = 0, _c = Object.keys(attributes); _b < _c.length; _b++) {
                    var key = _c[_b];
                    details += key + ": " + attributes[key] + "\n";
                }
                for (var _d = 0, _e = Object.keys(tags); _d < _e.length; _d++) {
                    var key = _e[_d];
                    if (!(key in attributes)) {
                        throw "Error in parsing test case\n" + test_case + "\n. Expected to find attribute \"" + key + "\" but didn't.\n" + details;
                    }
                    if (tags[key] !== attributes[key]) {
                        throw "Error in parsing test case\n" + test_case + "\n. Value mismatch in tag \"" + key + "\".\n" + details;
                    }
                }
            }
            assert_params("", {});
            assert_params(" \t\n", {});
            assert_params("test=value", { test: "value" });
            assert_params("test= \t\nvalue", { test: " \t\nvalue" });
            assert_params("attribute=test [if a=42 b else c] bla bar=10", { attribute: "test [if a=42 b else c] bla", bar: "10" });
            assert_params("text=[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]", { text: "[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]" });
            console.log(parse_attributes("text=[choice next=travel text=Take the sword var=weapon=herosword]\n[choice next=travel text=Leave the sword]"));
        }
        function parse_source_text_test() {
            return __awaiter(this, void 0, void 0, function () {
                function test(source) {
                    var expected_tags = [];
                    for (var _i = 1; _i < arguments.length; _i++) {
                        expected_tags[_i - 1] = arguments[_i];
                    }
                    tags = [];
                    parse_source_text(source, "test.txt");
                    for (var index in tags) {
                        if (arguments[Number(index) + 1] !== tags[Number(index)]) {
                            var err = "Failed parsing source \"" + source + "\" into appropriate tags.\n";
                            err += "Expected:\n";
                            for (var _a = 0, expected_tags_1 = expected_tags; _a < expected_tags_1.length; _a++) {
                                var expected_tag = expected_tags_1[_a];
                                err += expected_tag + "\n";
                            }
                            err += "Actual:\n";
                            for (var _b = 0, tags_1 = tags; _b < tags_1.length; _b++) {
                                var tag = tags_1[_b];
                                err += tag + "\n";
                            }
                            throw err;
                        }
                    }
                }
                var old_execute_tag, tags;
                var _this = this;
                return __generator(this, function (_a) {
                    old_execute_tag = execute_tag;
                    execute_tag = function (str) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            tags.push(str);
                            return [2 /*return*/, ""];
                        });
                    }); };
                    test("[choice next=travel text=Leave the sword]", "choice next=travel text=Leave the sword");
                    test("[code text=[choice next=travel text=Leave the sword]]", "code text=[choice next=travel text=Leave the sword]");
                    test("[code bla test 42]", "code bla test 42");
                    test("[code [inner tag=valid]]", "code [inner tag=valid]");
                    execute_tag = old_execute_tag;
                    return [2 /*return*/];
                });
            });
        }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    parse_tags_tests();
                    return [4 /*yield*/, parse_source_text_test()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// script entry point, loading the correct state and displays errors
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, run_tests()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, play_arc("intro")];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, url_hash_change()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_5 = _a.sent();
                    display_error_document("" + err_5);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
main();
