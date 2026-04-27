# Compiled RGE Script

This is a "compiler" for RGE in BRM5. The primary purposes of the involved systems are to allow you to:
1. Use basic logic systems within RGE with minimal manual setup
2. Import any text file into the RGE console


## MD

## Table of Contents







## Compiler

The compiler uses `.crs` files, converting them to `.txt` files of commands which you can easily use the Importer to put in game.

The compiler takes two parameters, the file to compile from, and the output file. It requires a `crsconfig.json` to exist in the same directory it's ran from, if not, it will create a default one and stop (thus requiring you to rerun it).

### Syntax

There are several key concepts required to understand

#### Comments

Commenting follows JavaScript commenting rules. **As of writing, there is a known issue due to how comments are parsed, a multiline comment can not be commented out, as in if a multiline comment is inside a single line comment, it will still escape characters.**

Single line comments use `//`, and multiline start with `/\*` and end with `\*/`.


#### Toplevel API

Internal notes color $\color{gray}{\text{message}}$

`namespace <name>` - Define the current namespace, you can not repeat existing namespaces. See the [parent header](#compiler) for more info.

`func <name> {...}` - Define a function with the name. You can use `call` on functions, aswell as `expose` them. $\color{gray}{\text{All functions are internally made into templates}}$

`template <name> (<...params>) {...} ` - Define a template, 



### Scope API







### Examples

Examples are very useful for coding, espically when the api is relatively esoteric.

A basic setup could look like this

```
namespace myscript
global *active 0
func toggle {
    if *active {
        set *active 0
    } else {
        set *active 1
    }
}
expose toggle FlipState
```










## Importer

The importer is relatively simple, but still extremely useful.

It takes one parameter, the file to import.

Upon running, if you do not pass a file name (such as running it via clicking), it will ask for a file name before starting.

When it starts, you will have 10 seconds to get to the game before it starts pasting.

When it stops it has fully ended, it only waits a small time between inputs so that is your clear tell.












