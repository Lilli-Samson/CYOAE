#include "cyoaeLexer.h"
#include "cyoaeParser.h"
#include <antlr4-runtime.h>

#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static auto &log_stream = std::cout;

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
	void visitTerminal(antlr4::tree::TerminalNode *node) override {}
	void visitErrorNode(antlr4::tree::ErrorNode *node) override {}
	void enterEveryRule(antlr4::ParserRuleContext *ctx) override {}
	void exitEveryRule(antlr4::ParserRuleContext *ctx) override {
		if (const auto text = dynamic_cast<cyoaeParser::TextContext *>(ctx)) {
			log_stream << "Text: [" << text->getText() << "]\n";
		} else if (const auto tag = dynamic_cast<cyoaeParser::TagContext *>(ctx)) {
			log_stream << "Tag: [\n";
			for (const auto &child : tag->children) {
				if (const auto tag_name = dynamic_cast<cyoaeParser::Tag_nameContext *>(child)) {
					log_stream << "\tname: " << tag_name->getText() << '\n';
				} else if (const auto attribute = dynamic_cast<cyoaeParser::AttributeContext *>(child)) {
					log_stream << "\tattribute: " << attribute->getText() << '\n';

				} else if (const auto value = dynamic_cast<cyoaeParser::ValueContext *>(child)) {
					log_stream << "\tvalue: " << value->getText() << '\n';
				}
			}
			log_stream << "]\n";
		}
	}
};

static void compile_scene(std::filesystem::path scene_path) {
	log_stream << "Compiling scene " << scene_path.c_str() << '\n';
	std::ifstream input_file{scene_path};
	antlr4::ANTLRInputStream input(input_file);
	cyoaeLexer lexer(&input);
	antlr4::CommonTokenStream tokens(&lexer);
	tokens.fill();
	cyoaeParser parser(&tokens);
	ParserErrorListener error_listener{scene_path.c_str()};
	ParseTreeListener parser_listener;
	parser.addErrorListener(&error_listener);
	parser.addParseListener(&parser_listener);
	parser.start();
}

static void compile_story(std::filesystem::path story_path) {
	const auto arcs_path = story_path / "story arcs";
	try {
		std::filesystem::directory_iterator{arcs_path};
	} catch (const std::filesystem::filesystem_error &error) {
		throw std::runtime_error{"Failed parsing story in " + std::filesystem::absolute({arcs_path}).string()};
	}

	log_stream << "entering story " << story_path.c_str() << '\n';
	for (auto &arc_path : std::filesystem::directory_iterator(arcs_path)) {
		log_stream << "entering arc " << arc_path.path().c_str() << '\n';
		for (auto &scene_path : std::filesystem::directory_iterator(arc_path)) {
			compile_scene(scene_path);
		}
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
