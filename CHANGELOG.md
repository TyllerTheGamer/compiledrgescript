# CRS Changelog

* [Major 0](#version-0)
* * [Minor 3](#minor-version-0--3)
* * * [Patch 3](#0--3--0)

# Version 0

Beta, main features still being fully decided, developed, and tested.

## Minor Version 0 . 3

Working beta release, still being improved upon but lots of changes to the compiler.

### 0 . 3 . 0

$\color{lime}{\text{-}}$ Made this changelog\
$\color{lime}{\text{-}}$ Added direct browser support\
$\color{lime}{\text{-}}$ Added `allowFileCommand` boolean to config, default false. If false any raw command that starts with `file` when being converted to commands will make the compiler stop. The only exemption is `file insertmodel` which is specifically whitelisted even when the setting is false (as there are no malicious actions that can happen due to it).\
$\color{lime}{\text{-}}$ Added `mul(#x #y)` instruction, mutliplies x y and outputs a number result (* is taken by globals)\
$\color{lime}{\text{-}}$ Made `num` values coercable to `str`\
$\color{yellow}{\text{-}}$ Removed requirement for `%` for template parameter reference (still works to reference parameters but not required)\
$\color{yellow}{\text{-}}$ Enabled combiner results being negative (to make an initially negative value do 0 - value)\
$\color{yellow}{\text{-}}$ Took note of ability to store funcs and templates in compiler vars.\
$\color{yellow}{\text{-}}$ Started on semantic tokenization support (NOT FINISHED)\
$\color{red}{\text{-}}$ Moved all errors returned by `testScript` to `res.errs` instead of having one arbitrarily on the base object\
$\color{cyan}{\text{-}}$ Fixed compiler error highlighting being offset by one each line due to carriage returns being removed\
$\color{cyan}{\text{-}}$ Fixed `!command` insertion incorrectly offsetting text index tracing\
$\color{purple}{\text{-}}$ Added `argpats` pattern store\




