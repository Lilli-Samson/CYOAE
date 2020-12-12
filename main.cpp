#include "cyoaeLexer.h"
#include "cyoaeParser.h"
#include <antlr4-runtime.h>

#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static constexpr auto html_intro = R"(<!doctype html>
<html lang="en">
<head>
   <meta charset="utf-8">
   <title>CYOAE</title>
   <link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body>
)";
static constexpr auto html_outro = R"(</body>
</html>
)";

static auto &info_stream = std::clog;
static auto &warning_stream = std::cout;
static auto &error_stream = std::cerr;

struct Attribute {
	std::string name;
	std::string value;
};

struct Tag {
	antlr4::ParserRuleContext *ctx;
	std::string name;
	std::string value;
	std::vector<Attribute> attributes;
};

static std::string get_position(antlr4::ParserRuleContext *ctx) {
	//todo
	return "unknown";
}

static std::string escape_html(std::string_view input);

static std::string html_comment(std::string_view content) {
	return "<!--" + escape_html(content) + "-->\n";
}

static void execute_tag(const Tag &tag, std::ostream &output) {
	auto fail = [&output](std::string_view text) {
		output << html_comment(text);
		warning_stream << text << '\n';
	};
	if (tag.name == "img") {
		std::string_view url;
		std::string_view alt = "image";
		if (not tag.value.empty()) {
			url = tag.value;
		}
		for (const auto &[attribute, value] : tag.attributes) {
			if (attribute == "alt") {
				alt = value;
			} else if (attribute == "url") {
				url = value;
			} else {
				fail("Unknown attribute " + attribute + " in tag " + tag.name);
			}
		}
		if (url.empty()) {
			fail("No url specified for img tag");
			return;
		}
		//todo: make the image adapt in size and maybe provide the size
		output << "<img src=\"" << url << "\" alt=\"" << escape_html(alt) << "\">\n";
	} else if (tag.name == "code") {
		output << "<a class=\"code\">" << escape_html(tag.value) << "</a>\n";
	} else if (tag.name == "choice") {
		std::string_view next;
		std::string_view text;
		for (const auto &[attribute, value] : tag.attributes) {
			if (attribute == "next") {
				next = value;
			} else if (attribute == "text") {
				text = value;
			} else {
				fail("Unknown attribute " + attribute + " in tag " + tag.name);
			}
		}
		if (next.empty()) {
		}
		output << "<a class=\"choice\" href=\"" << next << ".html\">" << escape_html(text) << "</a>\n";
	} else {
		fail("Unknown tag " + tag.name);
	}
}

static std::string escape_html(std::string_view input) {
	std::string result;
	result.reserve(input.size());
	for (char c : input) {
		switch (c) {
			case '&':
				result += "&amp;";
				break;
			case '<':
				result += "&lt;";
				break;
			case '>':
				result += "&gt;";
				break;
			case '"':
				result += "&quot;";
				break;
			case '\'':
				result += "&#39;";
				break;
			case '\n':
				result += "<br>\n";
				break;
			default:
				result += c;
		}
	}
	return result;
}

class ParserErrorListener : public antlr4::BaseErrorListener {
	public:
	ParserErrorListener(const char *filename)
		: filename{filename} {}

	private:
	void syntaxError(antlr4::Recognizer *recognizer, antlr4::Token *offendingSymbol, size_t line, size_t charPositionInLine, const std::string &msg,
					 std::exception_ptr e) override {
		std::ostringstream oss;
		oss << "In " << filename << " line " << line << " character " << charPositionInLine << ": Error " << msg;
		throw std::runtime_error(oss.str());
	}
	const char *filename;
};

class ParseTreeListener : public antlr4::tree::ParseTreeListener {
	public:
	ParseTreeListener(std::ostream &out)
		: output{out} {}

	private:
	void visitTerminal(antlr4::tree::TerminalNode *node) override {}
	void visitErrorNode(antlr4::tree::ErrorNode *node) override {
		error_stream << node->toStringTree(true);
	}
	void enterEveryRule(antlr4::ParserRuleContext *ctx) override {}
	void exitEveryRule(antlr4::ParserRuleContext *ctx) override {
		if (const auto text = dynamic_cast<cyoaeParser::TextContext *>(ctx)) {
			info_stream << "Text: [" << text->getText() << "]\n";
			output << "<a class=\"text\">" << escape_html(text->getText()) << "</a>\n";
		} else if (const auto tag = dynamic_cast<cyoaeParser::TagContext *>(ctx)) {
			Tag tag_values{ctx};
			info_stream << "Tag: [\n";
			for (const auto &child : tag->children) {
				if (const auto tag_name = dynamic_cast<cyoaeParser::Tag_nameContext *>(child)) {
					info_stream << "\tname: " << tag_name->getText() << '\n';
					tag_values.name = tag_name->getText();
				} else if (const auto attribute = dynamic_cast<cyoaeParser::AttributeContext *>(child)) {
					info_stream << "\tattribute: " << attribute->getText() << '\n';
					tag_values.attributes.push_back({attribute->getText(), {}});

				} else if (const auto value = dynamic_cast<cyoaeParser::ValueContext *>(child)) {
					info_stream << "\tvalue: " << value->getText() << '\n';
					if (tag_values.attributes.empty()) {
						tag_values.value = value->getText();
					} else {
						tag_values.attributes.back().value = value->getText();
					}
				}
			}
			info_stream << "]\n";
			execute_tag(tag_values, output);
		}
	}
	std::ostream &output;
};

static void compile_scene(std::filesystem::path scene_path, std::ostream &output) {
	info_stream << "Compiling scene " << scene_path.c_str() << '\n';
	std::ifstream input_file{scene_path};
	antlr4::ANTLRInputStream input(input_file);
	cyoaeLexer lexer(&input);
	antlr4::CommonTokenStream tokens(&lexer);
	tokens.fill();
	cyoaeParser parser(&tokens);
	ParserErrorListener error_listener{scene_path.c_str()};
	ParseTreeListener parser_listener{output};
	parser.addErrorListener(&error_listener);
	parser.addParseListener(&parser_listener);
	parser.start();
}

static void compile_story(const std::filesystem::path &story_path, std::filesystem::path output_path = ".") {
	const auto arcs_path = story_path / "story arcs";
	try {
		std::filesystem::directory_iterator{arcs_path};
	} catch (const std::filesystem::filesystem_error &error) {
		throw std::runtime_error{"Failed parsing story in " + std::filesystem::absolute({arcs_path}).string()};
	}

	info_stream << "entering story " << story_path.c_str() << '\n';
	output_path /= story_path.filename();
	for (auto &arc_path : std::filesystem::directory_iterator(arcs_path)) {
		output_path /= arc_path.path().filename();
		std::filesystem::create_directories(output_path);
		info_stream << "entering arc " << arc_path.path().c_str() << '\n';
		for (auto &scene_filepath : std::filesystem::directory_iterator(arc_path)) {
			const auto extension = scene_filepath.path().extension();
			if (extension != ".txt") {
				info_stream << "Skipping file " << scene_filepath << " because it's not a .txt file\n";
				continue;
			}
			output_path /= scene_filepath.path().filename();
			output_path.replace_extension("html");
			std::ofstream output{output_path};
			if (not output.is_open()) {
				throw std::runtime_error{std::string{} + "Failed opening output file" + output_path.c_str()};
			}
			output << html_intro;
			compile_scene(scene_filepath, output);
			output << html_outro;
			output_path.remove_filename();
		}
		output_path.remove_filename();
	}
}

int main(int argc, const char *argv[]) {
	if (argc < 2) {
		try {
			compile_story(".");
		} catch (const std::exception &error) {
			std::cout << "Failed compiling story in current directory. Pass the story directory as an argument. It should contain a \"story arcs\" directory. "
						 "Reason: "
					  << error.what();
		}
	} else {
		for (int i = 1; i < argc; i++) {
			try {
				compile_story(argv[i]);
			} catch (const std::exception &error) {
				std::cout << "Failed compiling story in " << std::filesystem::absolute(argv[i]) << ".\nReason: " << error.what() << '\n';
			}
		}
	}
}
