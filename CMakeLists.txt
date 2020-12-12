cmake_minimum_required(VERSION 3.5)

project(CYOAE LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_INCLUDE_CURRENT_DIR ON)
add_definitions("-Wall" "-g" "-flto" "-fsanitize=undefined,address")
add_link_options("-fsanitize=undefined,address")

set(ANTLR_SRC
	cyoaeBaseListener.cpp
	cyoaeBaseListener.h
	cyoaeLexer.cpp
	cyoaeLexer.h
	cyoaeListener.cpp
	cyoaeListener.h
	cyoaeParser.cpp
	cyoaeParser.h
)
add_custom_command(
	OUTPUT
	${ANTLR_SRC}

    COMMAND
	antlr4 -Dlanguage=Cpp ${CMAKE_CURRENT_SOURCE_DIR}/cyoae.g4 -o ${CMAKE_BINARY_DIR}
	
    MAIN_DEPENDENCY
	cyoae.g4
	
	COMMENT
	"Generating ANTLR parser"
)

include_directories(${PROJECT_SOURCE_DIR} "/usr/include/antlr4-runtime")
file(GLOB SRC_FILES ${PROJECT_SOURCE_DIR}/*.cpp)
add_executable(CYOAE
	${SRC_FILES} ${ANTLR_SRC}
)
target_link_libraries(CYOAE antlr4-runtime stdc++fs)
