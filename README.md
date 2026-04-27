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

There are several key concepts required to understand.

Internally, the compiler turns your script into triggers ran by bots falling through bits, don't question how it works but it does.

**You must start by defining a namespace.** The compiler requires a namespace for everything, and will throw if you do not start by defining a namespace.

**Keywords are reserved.** You can not use keywords for names inside the compiler, the restrictions on commands/trigger names are different however.

**You can not start a trigger with `_crs_`.** The compiler prefixes all the triggers it generates (except for exposes) with this.

**Strings and raw commands can not include `@`.** this is reserved for some internal logic in the compiler, and there is no place you can use `@` in a command.


#### Documentation Guide

Any `<value>` means a value you insert, and `<...values>` means any number of values seperated by whitespace.

All `<name>` values are the name of the item regarded in the documentation, should be self-explanatory.

A bit is 0 or 1.

A compiler var can be a number or a reference to another compiler var. A number is defined as a positive integer or 0.

A group var uses `<...>` to hold bits, strings, or more groups. An example is `<0 1 0 1>`, and you can do this with strings or groups aswell. They are coercable to a compiler var equal to their length, as in you can treat them as a compiler var equal to their length. A group var can not contain compiler vars due to issues with how you would specify a bit or compiler var, and how you would even accessor them.

A string is text wrapped in `"`, such as `"text"`. In raw commands and strings, you can do text insertion.

Namespaces are used to make code dynamic. You can reference global values, functions templates and global variables, in other namespaces via `namespace:name` syntax, replacing namespace with the namespace and name with the item to accessor.

There are 3 instructions to define variables in different scopes, so how variable declartions work is defined below.

Variables can be compiler or regular. You define a compiler var by prefixing the variable name with `#`, which becomes apart of its name. In order to reference a template parameter, you must prefix `%`, and for global variables `*`, you must do the global variable reference even toplevel. If you have a global compiler var for example, you would do `*#variable`.

Variable declartions use the `definer <name> <value>` syntax, `name` must be a valid variable name, `value` must be a valid value, and will be the default state for bits, and `define` will be the specific instruction.

When any variable declartion other than `global` is hit, it resets the value to the default value, and global still defines the default state, but does not reset due to there being no need/spot to do so.

Variables can not be referenced before declartion. Global variables are declared before all scopes.





#### Comments

Commenting follows JavaScript commenting rules. **As of writing, there is a known issue due to how comments are parsed, a multiline comment can not be commented out, as in if a multiline comment is inside a single line comment, it will still escape characters.**

Single line comments use `//`, and multiline start with `/\*` and end with `\*/`.


#### Toplevel API

Internal notes color template $\color{gray}{\text{message}}$



`namespace <name>` - Declare the current namespace, you can not repeat existing namespaces. See the [parent header](#compiler) for more info.

`func <name> {...}` - Define a function. You can use `call` on functions, aswell as `expose` them. $\color{gray}{\text{All functions are internally made into triggers, and do not use their names for their trigger names.}}$

`template <name> (<...params>) {...} ` - Define a template. `...params` are optional valid variable names.

`expose <function> <trigger>` - Exposes a function via a trigger. The trigger can not start with `_crs_`, and must be 25 or less characters long due to RGE limitations.

`copy <function> <newfunc>` - Copies a function. Due to the async nature of the system, you may want to be able to run logic multiple times seperately, copy duplicates a function named `function` and makes a function named `newfunc` with the same contents, and duplicates the internal variables.

`global <name> <value>` - Defines a global variable. See variable declartions in the guide for more info.

`init [...cmds]` - NOT IMPLIMENTED. Adds commands to the base initialization of the script. This is ran every time the world is loaded, should be used for bots.

`globalinit [...cmds]` - Adds commands to the global initialization of the script. Ran only when then


#### Scope API

There are two scoped instructions that can only be used in what is referred to as a superscope. A template body or function body are superscopes.

`var <name> <value>` - Function superscope only, defines a variable specific to the function. See variable declartions in the guide for more info.

`local <name> <value>` - Template superscope only, defines a variable for each use of a template. See variable declartions in the guide for more info.

The following can only be used while inside a for loop (includes inner ifs).

`continue` - Skips to the next iteratoin of the current for loop.

`break` - Stops the for loop.

The rest are for any scope, meaning they can go anywhere not toplevel to the script.

`set <name> <value>` - Sets a variable to a value. This can only be used on bit variables, so `value` must be a bit.

`if <var> {tcase...} else {fcase...}` - Defines an if statement. `var` must be a bit variable. `tcase` will be ran if the variable is true, and `fcase` will be ran if it is false. You can not exclude the else, but can just have it with no contents.

`for (<iterator> <config>) {...}` - Defines a for loop. The `iterator` must be a compiler var that has not been already defined, and will be set to the current index of the loop in each iteration. The `config` must be a for loop config. It can either be a group variable, or `(<start> <end> <step> <direction>)`. `start` and `end` are required, and must be compiler vars or numbers that say where the loop starts and end. `step` by default is `1`, but can be a compiler var or number. `direction` must be `U` or `D`, and defaults to `U`, `U` is up, meaning it adds the step to the start, and `D` is down, meaning it subtracts the step from the start. If the `iterator` goes negative the compiler will throw.

`call <name>` - Calls a function. Same as trigger activate so it is async.

`use <name> (...<params>)` - Uses a template. Params must be equal to the parameter length of the template.

`return` - Stops the current function or template early.

### Examples

Examples are very useful for coding, espically when the api is relatively esoteric.

A basic setup could look like this:

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












