cmake_minimum_required(VERSION 3.5)

project(CYOAE LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
add_definitions("-Wall" "-g" "-flto")
include_directories(${PROJECT_SOURCE_DIR} "/usr/include/antlr4-runtime")
file(GLOB SRC_FILES ${PROJECT_SOURCE_DIR}/*.cpp)
add_executable(CYOAE
	${SRC_FILES}
)
target_link_libraries(CYOAE antlr4-runtime stdc++fs)
