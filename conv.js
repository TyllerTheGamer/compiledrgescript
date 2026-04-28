import fs from "fs";
import { isSea } from "node:sea";
import * as readline from "node:readline/promises";
//import { execSync } from "node:child_process";
//import readline from "node:readline";
import process, { threadCpuUsage } from "node:process";

const DEBUG = false;

// gonna first do config stuff

const defaultConfig = {
    worldId: 129,
    xOrigin: -4000,
    yOrigin: 300,
    zOrigin: 1000,
    xMirrored: false,
    zMirrored: false,
    doCommandSpeedTradeoff: false // DOESNT WORK, turns out triggers cant run trigger executable
};

const runbuilt = true;


// ai helped me with CLI/sea stuff generally, well more notably then the rest of it

// lazy started so I don't have to shove this at the bottom
async function startBuilt() {
    // first check config
    if (!fs.existsSync("crsconfig.json")) {
        console.log(`Could not find "crsconfig.json" file.`);
        fs.writeFileSync("crsconfig.json", JSON.stringify(defaultConfig, null, 4));
        console.log(`A default config has been created, please relaunch.`);
        await passiveExit();
        return;
    }
    const cfg = JSON.parse(fs.readFileSync("crsconfig.json", "utf8"));
    baserot.x = cfg.xMirrored ? -1 : 1;
    baserot.z = cfg.zMirrored ? -1 : 1;
    basecords.x = cfg.xOrigin;
    basecords.y = cfg.yOrigin;
    basecords.z = cfg.zOrigin;
    if (cfg.doCommandSpeedTradeoff) console.warn(`The command speed tradeoff method does not work.`);
    doSpeedTradeoff = false;//cfg.doCommandSpeedTradeoff;
    worldnum = cfg.worldId;
    const args = await checkParams();
    if (!fs.existsSync(args[0])) {
        console.log(`Could not find file "${args[0]}"`);
        await passiveExit();
        return;
    }
    rawscript = fs.readFileSync(args[0], "utf8").replaceAll("\r", "");
    curr = rawscript;
    outFile = args[1];
    compile();
}

// specifically so I can copy paste rip this out :P
// param names, manual config for being per file
const pnames = ["File to Build", "Output File"];
async function checkParams() {
    // ai convos got me confused/tried to trip me up, node makes it so argv[0] is jsut... the exe again
    const args = process.argv.slice(2);//isSea() ? process.argv.slice(1) : process.argv.slice(2);
    if (args.length != 0 && args.length != pnames.length) {
        console.log(`Issue! Got args of length "${args.length}", expected "0" or "${pnames.length}"`);
        await passiveExit();
        return;
    }
    if (args.length == 0) {
        //console.log(`No arguments detected`);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        for (const name of pnames) {
            args.push(await rl.question(`${name}: `));
        }
        rl.close();
    }
    return args;
}



// THIS FUNCTION BELOW IS DIRECTLY FROM AI, taken from togame and slightly stripped
/**
 * Focuses the current terminal window and waits for user input before exiting.
 */
async function passiveExit() {

    try {
        // This PowerShell command finds the process ID of the current Node window 
        // and forces it to the foreground/focus.
        const focusCommand = `powershell -Command "$rs = Add-Type -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd);' -Name 'Win32' -Namespace 'Win32' -PassThru; $hwnd = (Get-Process -Id $pid).MainWindowHandle; $rs::SetForegroundWindow($hwnd)"`;
        // unfortunatley windows gets mad and Im not gonna make everybody have to disable smart whatever
        //execSync(focusCommand);
    } catch (err) {
        console.log("Could not auto-focus window.");
    }

    // Create the "Press any key to exit" interface
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        console.log("Press any key to exit...");
        
        // Set raw mode to capture a single keypress instead of waiting for 'Enter'
        process.stdin.setRawMode(true);
        process.stdin.resume();
        
        process.stdin.on("data", () => {
            process.stdin.setRawMode(false);
            rl.close();
            console.log("Exiting...");
            process.exit(0); 
        });
    });
}



// lsp rn will be reaching out weirdly but that works fineeee
const islsp = globalThis.runningCRSLSP; // custom flag



// all the below were consts before config


let baseFile = "./test.crs";
// about right above fob just for temporary testing/visually seeing ingame
let basecords = {
    x: -4001,
    y: 251,
    z: 730,
};
// considered delaying making baserot, but better if I make it now
// NOT REALLY ROTATION, just multipliers, so you can flip the entire system if you need it to run off not into all your things already on your map
let baserot = {
    x: 1,
    z: 1,
};
let worldnum = 150; // what rge world id to use
let outFile = "./cmds.txt";
// IMPORTANT, possibly try to change it to rewire each call to the if instead of mediator triggers
let doSpeedTradeoff = true; // whether to do 1 command or n commands for writing


// internal consts, wanted to be able to easily mess with spacers

const bitspacer = 11;
const ifspacer = 20;

// coordinate consts
const _basecc = {
    // was 18, but with trigger and spawn being relative I can acutally use 0, didn't use it at first cus I was too tired to check whats 26-18
    biton: [0, 0, -3],
    bitoff: [0, 0, 3],
    // automatically just relative to bit on bit off, with x added
    trigger: [0, -9, 0],
    spawn: [0, 8, 0],
    //tcase: [0, 9, -3],
    //fcase: [0, 9, 3],
    //tspawn: [0, 26, -3],
    //fspawn: [0, 26, 3]
};

// lazy thing
const cc = Object.fromEntries(Object.entries(_basecc).map(([_, v]) => [_, {x:v[0],y:v[1],z:v[2]}]));



let rawscript = islsp || runbuilt ? "" : fs.readFileSync(baseFile, "utf8").replaceAll("\r", ""); // filter window's carriage return
let lines = [];
// use this for other things but it works fine
let tempcounter = 0; // counter for making template related elements unique
const tempnum = () => ++tempcounter; // as long as the number is saved its fine to get this as unneccassarily high as we want



function l(str) {
    lines.push(str);
}

// made this while actually far into the project and at the step I need line stuff
let toplines = [];
let latelines = [];
let triggers = {};
let bitmap = {};
let bits = [];

function topl(...str) {
    toplines.push(...str);
}

function latel(...str) {
    latelines.push(...str);
}

// bc I can't remember the trigger syntax rn and it'll be possible to do this

function trigg(name) {
    if (triggers[name]) throw new TypeError(`Compiler tried to make trigger "${name}" that already exists, should not happen`);
    if (name.length > 25) throw new TypeError(`Compiler tried to make trigger "${name}" which is longer than 25 characters, should not happen`);
    const obj = {name};
    obj.lines = [];
    obj.add = (...l) => obj.lines.push(...l);
    triggers[name] = obj;
    return obj;
}

function log(...args) {
    if (islsp) return;
    console.log(...args);
}


function finish() {
    if (islsp) return;
    //console.log(`Writing...`);
    // do this all here
    log("Forming command lines...");
    lines.unshift(...toplines);
    for (const t of Object.values(triggers)) {
        l(`trigger create ${worldnum} ${t.name}`);
        if (!doSpeedTradeoff) l(`trigger whitelist ${worldnum} ${t.name} Bots true`);
        let next = 1; // next line, p sure to start at 1
        const exec = (line) => l(`trigger executable ${worldnum} ${t.name} ${next++} ${line}`);
        for (const line of t.lines) {
            //l(`trigger executable ${worldnum} ${t.name} ${next++} `);
            exec(line);
        }
        exec(`wait 0.1`);
        // p sure just reset works, I think manual trigger reset command didn't bypass
        exec(`reset`);
        // always reset, gotta wait to reset, confirmed via testing
        //l(`trigger executable ${worldnum} ${t.name} `)
    }
    lines.push(...latelines);
    // put these at the end
    lines.push(...ginits);
    const script = lines.join("\n");
    log("Writing commands to file...");
    fs.writeFileSync(outFile, script);
    log("Wrote commands");
    //console.log(`Wrote commands`);
}

// prolly have extends idk
class bitvar {
    static allvar = [];
    constructor(label) {
        bitvar.allvar.push(this);
        this.label = label;
    }
}

// values, just for instanceof check

class value {}

// 1 or 0
class bit extends value {
    constructor(state) {
        this.state = state;
    }
}

// only compiler variables, which are (rn atleast) numbers
class cnum extends value {
    constructor(num) {
        this.val = num;
    }
}


// kinda a better idea of above, has groups and such
class vari {
    static all = {};
    // val will be one of the above
    constructor(label, val) {
        if (!(val instanceof value)) throw new TypeError();

    }
}


// write the current data object/just the top data object when erroring for tesitng
const writeIssued = true;

// apparently I made cyclic stuff which sorta makes sense but still need to log it so yeahh
// thank AI cus this woulda taken relatively long for me to think of on my own
// did modify/make some on my own still but yeahhh
function safeStringify(obj) {
    const seen = new Map();

    const branch = (obj, stack) => {
        if (obj === undefined) return "undefined";
        if (obj == null || typeof obj != "object") return obj;
        if (stack.startsWith(seen.get(obj))) return `[Circular -> ${seen.get(obj)}]`;
        seen.set(obj, stack);
        if (Array.isArray(obj)) return obj.map((v, i) => branch(v, `${stack}.${i}`));
        const res = {};
        for (const [key, val] of Object.entries(obj)) {
            res[key] = branch(val, `${stack}.${key}`);
        }
        // delete after we move past it
        seen.delete(obj);
        return res;
    };

    return JSON.stringify(branch(obj, "root"), null, 2);
}
const clone = (obj) => JSON.parse(JSON.stringify(obj));


function tryWrite() {
    return;
    if (writeIssued) {
        const write = {
            //tdat,
            ploops,
            currns,
            currscope,
            allns
        };
        //fs.writeFileSync("./issued.json", safeStringify(write));
    }
}

// expects raw file contents
let errs = []; // errors that weren't thrown 
export function testScript(file) {
    rawscript = file.replaceAll("\r", "");
    curr = rawscript;
    lines = [];
    toplines = [];
    latelines = [];
    triggers = [];
    cdat = [];
    tdat = cdat;
    cidx = 0;
    tempcounter = 1;
    currns = null;
    currscope = null;
    erred = false;
    // only reason all these are lets instead of consts at definition
    inits = [];
    ginits = [];
    exposes = [];
    allns = {};
    vstore = {};
    tstore = {};
    errs = [];
    allscopes = [];
    loops = [];
    ploops = [];
    dbgvlkup = {};
    ptemps = [];
    pifs = {};
    followups = {};
    bitmap = {};
    bits = [];
    try {
        compile();
    } catch(e) {
        //tryWrite();
        return {idx:didx, eidx: edidx, err:e.message, success: false, errs};
    }
    //tryWrite();
    return {success: true};
}


// didx assumed to be start
let edidx = null;

// should be passed a length
function issue(val, message) {
    if (val) {if (typeof val == "string") val = val.length;
    if (typeof val == "object" && val.val) {
        if (val.idx) didx = val.idx;
        val = val.eidx ? (val.eidx - didx) : val.val.length;
    }
    edidx = didx + val;}
    throw new TypeError(message);
}

// part of trying to transition to proper way of error reporting, lets us not have to throw,
// almost said would cause issues later when we know we hit an error and thus cant do
// anything, an errored property would be mehhh, so just gonna have the next phase not start
// if we error, also just copy pasted issue mostly
let erred = false;
function sissue(val, message) {
    if (!islsp) issue(val, message);
    if (val) {if (typeof val == "string") val = val.length;
    if (typeof val == "object" && val.val) {
        if (val.idx) didx = val.idx;
        val = val.eidx ? (val.eidx - didx) : val.val.length;
    }
    edidx = didx + val;}
    errs.push({idx:didx, eidx: edidx, err:message});
    erred = true;
}

function setidxs(obj) {
    didx = obj.idx;
    edidx = obj.eidx ?? obj.idx + obj.val.length;
}

function isswrap(autoissue, func, ...args) {
    try {
        return {success: true, res: func(...args)};
    } catch(e) {
        if (!islsp) throw e; // pass through
        if (autoissue) sissue(null, e.message);
        return {success: false, msg:e.message};
    }
}

function hiterred() {
    if (erred) throw new TypeError(`Had an issue`);
}

// writes are for debugging
function compile() {
    log("Started -> Cleaning text");
    cleanText();
    hiterred();
    log("Text cleaned -> Generating CST");
    parseText();
    hiterred();
    log("CST generated -> Making instructions");
    // quick toggle to make the LSP write our parsed script for very quick but somewhat questionable debugging (as it writes so often)
    //*
    //if (!islsp)
    //*/
        //fs.writeFileSync("./parsed.json", JSON.stringify(cdat, null, 2));
    //if (!islsp) fs.writeFileSync("./looklog.txt", looklog.join("\n"));
    // manually ensure first is namespace
    didx = cdat[0].idx;
    if (cdat[0].val != "namespace") issue(cdat[0].val.length, `Script starts without setting a namespace`);
    doPatterns(cdat, gpats);
    hiterred();
    // kinda going back over and spreading out what all I do here
    log("Instructions made; Now processing (No errors should happen now)");

    didx = 0;
    edidx = 0;
    // delete for logging
    for (const ns of Object.values(allns)) {
        for (const entry of Object.values(ns.d)) {
            if (entry.type == "template") delete entry.script;
        }
    }

    log("Preparing to handle loops...");

    // keeps order for idx
    for (const loop of loops) {
        ploops.push({
            joined: null,
            bodies: loop
        });
    }
    // did this so many times I just gotta do this
    // loop bodies
    function* LBs() {
        for (const loop of ploops) {
            for (const body of loop.bodies) {
                yield body;
            }
        }
    }

    const opcollect = (op, cb) => {
        for (const body of LBs()) {
            crawltrans(body, op, cb);
        }
        doallfunc(func => crawltrans(func.body, op, cb));
    };

    log("Collecting all ifs...");

    // crawl loops and funcs
    // need to overhaul doitd from here, might just make a new func straight up

    const iftrans = d => {
        // check cus it's so easy
        if (pifs[d.v.id]) throw new TypeError(`Duplicate if id "${d.v.id}" found, compiler is broken`);
        pifs[d.v.id] = d.v;
        d.v.ranitd = false;
        crawltrans(d.v.tbody, "if", iftrans);
        crawltrans(d.v.fbody, "if", iftrans);
        return {
            op: "doif",
            id: d.v.id
        };
    };
    opcollect("if", iftrans);

    log("Collecting all templates...");

    const temptrans = d => {
        ptemps.push(d.v.body);
        const idx = ptemps.length - 1;
        crawltrans(d.v.body, "use", temptrans);
        return {
            op: "tempuse",
            idx
        };
    };
    opcollect("use", temptrans);

    // ITD is If Tail Duplication

    log("Handling continues...");

    for (const body of LBs()) {
        doesc(body, "continue");
    }

    log("Merging loop iterations...");

    for (const loop of ploops) {
        loop.joined = loop.bodies.map(body => ({
            op: "spread",
            body
        }));
        crawlspread(loop.joined);
    }

    log("Handling breaks...");

    for (const loop of ploops) {
        doesc(loop.joined, "break");
    }

    log("Inlining loops...");

    doallssb(body => {
        crawltrans(body, "for", d => {
            const body = ploops[d.v.idx].joined;
            return {
                op: "spread",
                body
            };
        });
        crawlspread(body);
    });

    log("Handling returns...");

    doallssb(body => doesc(body, "return"));

    //log("");

    if (DEBUG) dbgwrite("preulog.txt", true);

    log("Inlining templates...");

    doallfunc(func => {
        const {body} = func;
        const useCrawler = d => {
            const body = ptemps[d.v.idx];
            crawltrans(body, "tempuse", useCrawler);
            return {
                op: "spread",
                body: body
            };
        }
        crawltrans(body, "tempuse", useCrawler);
        crawlspread(body);
    });


    //log("Doing follow ups for inlined templates...");

    log("Bubbling up if tails...");

    doallfunc(func => fullitd(func.body));

    if (DEBUG) dbgwrite("ulog.txt"); // don't do templates bc they're inlined

    log("Finished processing instructions; Converting to triggers");
    // wip on what logs I will do cus as of writing Im debugging itdnest
    // only call em allocations to be somewhat cool, they are vaguely allocations
    log("Collecting bits...");

    // kinda lazy, just removes the tempnum arbitrarily spaced ids
    // we don't need to do this for ifs
    for (const v of Object.values(vstore)) {
        if (v.type == "bit") {
            bits.push(v);
        }
    }

    // allocating feels a bit questionable for wording, but sounds cool and vaguely relates, like we dont allocate space bc we can't really try to care about what's already there
    log("Allocating bits...");

    // was a for of loop, but then I realized need the index for offsets
    for (let i = 0; i < bits.length; i++) {
        const bit = bits[i];
        offset(basecords, bit);
        bit.z += i * bitspacer * baserot.z;
        bit.ifs = []; // we collect these after cus I'm lazy and thats cleaner
        // realized I can very simply do this here
        bit.name = `_crs_bit${i}`;
        // true cords and false cords
        const tc = coffset(bit, cc.biton);
        const fc = coffset(bit, cc.bitoff);
        // for if offsets
        bit.tc = tc;
        bit.fc = fc;
        if (doSpeedTradeoff) {
            bit.on = [];
            bit.off = [];
        } else {
            bit.on = `move ${worldnum} %${bit.name} ${ac(tc, true)}`;
            bit.off = `move ${worldnum} %${bit.name} ${ac(fc, true)}`;
            topl(`create ${worldnum} part ${ac(tc, false)}`);
            // I am SO grateful that % references last spawned part
            topl(`size ${worldnum} % 500 2 2`);
            topl(`rename ${worldnum} % ${bit.name}`);
        }
    }

    log("Allocating triggers...");

    doallfunc(func => func.trigger = trigg(`_crs_func${tempnum()}`));
    for (const i of Object.values(pifs)) {
        i.tcase = trigg(`_crs_tif${i.id}`);
        i.fcase = trigg(`_crs_fif${i.id}`);
        if (doSpeedTradeoff) {
            i.decider = trigg(`_crs_if${i.id}`);
            i.run = `trigger activate ${worldnum} ${i.decider.name}`;
        } else i.run = []; // will be the commands to run it, filled in next step
        const bit = vstore[i.cond];
        bit.ifs.push(i);
    }
    // make exposes, semi lazy, but this works :P
    // was gonna acutally have the func trigger names be set... but this is fineeeee
    for (const [name, func] of Object.entries(exposes)) {
        // gotta manually do it so it can be at the top
        topl(
            `trigger create ${worldnum} ${name}`,
            `trigger executable ${worldnum} ${name} 1 trigger activate ${worldnum} ${func.trigger.name}`
        );
    }

    log("Generating trigger parts...");

    for (const bit of bits) {
        for (let idx = 0; idx < bit.ifs.length; idx++) {
            const i = bit.ifs[idx];
            if (doSpeedTradeoff) {
                // we don't care about cords so no reason to set them but more effort to NOT do so
                // set default state
                if (bit.state) {
                    i.decider.add(`trigger activate ${worldnum} ${i.tcase.name}`);
                } else {
                    i.decider.add(`trigger activate ${worldnum} ${i.fcase.name}`);
                }
            }
            for (const pair of [[bit.tc, bit.fc, i.tcase, bit.on], [bit.fc, bit.tc, i.fcase, bit.off]]) {
                if (doSpeedTradeoff) {
                    // local case, case is reserved keyword in js
                    const lcase = pair[2];
                    const state = pair[3];
                    // the amazing speed tradeoff
                    state.push(`trigger executable ${worldnum} ${i.decider.name} 1 trigger activate ${worldnum} ${lcase.name}`);
                } else {
                    const cord = ccopy(pair[0]);
                    cord.x += idx * ifspacer;
                    const ocord = ccopy(pair[1]);
                    ocord.x += idx * ifspacer;
                    const t = pair[2];
                    const scord = coffset(cord, cc.spawn);
                    const pcord = coffset(cord, cc.trigger);
                    i.run.push(`bot spawn ${worldnum} RLF_Melee ${ac(scord)} 0`);
                    // spawns an explosion at the trigger, and the other bit position, to try to kill this bot and for sure gotta kill the other
                    // Breach is breaching charge, might change it, prolly not cus type shouldn't matter
                    t.add(
                        `explosion 10 1000 ${ac(ocord)} Breach`,
                        `explosion 15 1000 ${ac(pcord)} Breach`,
                    );
                    // shouldn't ever need to reference these parts after
                    latel(
                        `create ${worldnum} part ${ac(pcord, false)}`,
                        `size ${worldnum} % 2 11 2`,
                        `trigger add ${worldnum} %`,
                        `trigger set ${worldnum} % ${t.name} True`,
                    );
                }
            }
        }
    }

    log("Generating trigger contents...");

    doallfunc(func => dotrigger(func.trigger, func.body));
    Object.values(pifs).map(i => {dotrigger(i.tcase, i.tbody);dotrigger(i.fcase,i.fbody)});

    log("Finished compiling");
    finish();
}

function dotrigger(t, body) {
    // inst is lazy for instruct/instruction
    for (const inst of body) {
        // non existent are useless ops
        const res = opmap?.[inst.op]?.(inst);
        if (res) t.add(...(Array.isArray(res) ? res : [res]));
    }
}

// maps ops to commands
// if an array is returned it's spread, should be array of strings or string
// ngl when making this I had to sorta realize... there are legit only 4 ops left at runtime, which makes sense with how small the stuff is but still
const opmap = {
    set(o) {
        const bit = vstore[o.idx];
        //console.log(bit.on);
        return o.state ? bit.on : bit.off;
    },
    doif(o) {
        const i = pifs[o.id];
        return i.run;
    },
    raw(o) {
        return o.lines;
    },
    call(o) {
        return `trigger activate ${worldnum} ${o.target.trigger.name}`;
    }
};

// arg cords, qucik wrapper to spread cords
function ac(cords, fillrot) {
    return `${cords.x} ${cords.y} ${cords.z}${fillrot ? " 0 0 0" : ""}`;
}

function offset(base, target) {
    for (const axis of ["x","y","z"]) {
        target[axis] ??= 0;
        target[axis] += base[axis];
    }
}

// copy offset
function coffset(base, target) {
    const res = {};
    for (const axis of ["x", "y", "z"]) {
        res[axis] = target[axis] ?? 0;
        res[axis] += base[axis];
    }
    return res;
}

function ccopy(base) {
    const res = {};
    for (const axis of ["x", "y", "z"]) {
        res[axis] = base[axis];
    }
    return res;
}

// capture segment, del is whether to splice what we capture
// captures until end, or doif and includes the doif
function capseg(scope, start, del) {
    const capped = [];
    for (let i = start; i < scope.length; del ? null : i++) {
        const entry = scope[i];
        if (["escaped", "doif"].includes(entry.op)) {
            capped.push(entry);
            break;
        }
        if (!["setfollow", "consedsetfollow"].includes(entry.op)) capped.push(entry);
        if (del) scope.splice(i, 1);
    }
    return capped;
}

function fullitd(scope) {
    // first parse followups
    crawltrans(scope, "setfollow", d => {
        const {id} = d.v;
        const seg = capseg(d.s, d.i, false);
        followups[id] = seg;
        return {
            op:"nop", // do consedsetfollow if want to show it in ast
            escop: d.v.escop,
            id: d.v.id
        };
    });
    // immediately pass to nest since rest would be all the same
    itdnest(scope);
}

function lkupif(obj) {
    return pifs[obj.id];
}

function itdnest(scope, tail=[]) {
    // find the first if, if we hit an escape nothing can be after it
    let i = 0;
    let consed = false;
    let incing = true;
    let dotail = true;
    let cutting = false;
    let got;
    let curr;
    let queue = [];
    for (; i < scope.length; incing ? i++ : null) {
        const {op} = scope[i];
        // we cut from a doif that was already parsed, meaning long chain of events but this is safe
        if (cutting) {
            scope.splice(i, 1);
            continue;
        }
        if (op == "escaped") {
            const seg = followups[scope[i].id];
            // comment out for debug seeing, leaving doesn't break anything
            scope.pop(); // remove the escaped op
            // ignore the tail bc this is specifically a custom/manual tail
            scope.push(...seg);
            dotail = false;
            // I realized an escape could/would insert a doif or another escape so do this
            //break;
        } else if (op == "doif") {
            incing = false; // always set false
            // always will want this
            let me = scope[i];
            let didcons = false;
            if (consed) {
                didcons = true;
                // this doif was next
                // splice us from it, we're a doif so we're already in there
                scope.splice(i, 1);
                // was gonna add tail here, thinking about how it would flow out, we don't need to include our tail or care about dotail
                // now nest into the bodies of the prior if
                // queue should work for proper ordering of some niche cases
                queue.push([curr.tbody, got]);
                queue.push([curr.fbody, got]);
            }
            // we always do this for doifs
            consed = true;
            //console.log(me, scope);
            // only do these the first time, since the rest we're splicing out
            if (!curr) {
                i++;
            }
            curr = lkupif(me);
            // actually defo need to handle it, so if we ranitd, it's that this is in an escape, I was about to say I should run over all set follows, but if an escape leads to another escape that would still be able to screw up... maybe
            // not sure if I need to do anything here??
            got = capseg(scope, i, true);
            // skips this one :P
            // okay turned it to a kinda sketchy, but this should work, nvm not that sketchy cus no break like I was planning
            if (curr.ranitd) {consed = false;cutting=true}
            curr.ranitd = true;
        }
    }
    if (consed) {
        curr.ranitd = true;
        // a doif wasn't next
        // bc it's the final if, if we haven't escaped we need to include our prior tail
        if (dotail) {
            got.push(...tail);
        }
        itdnest(curr.tbody, got);
        itdnest(curr.fbody, got);
    } else if (dotail) {
        // simply add the tail
        scope.push(...tail);
    }
    // got the idea to store these and then do it incase some tail run weird stuff happens that seems to have happened
    // btw ZERO clue what is exactly causing the issue where it has to be after, its somethign vaguely related to misordering of writing tails it seems
    for (const [body, tail] of queue) {
        itdnest(body, tail);
    }
    // otherwise an escape did our job for us, since we no longer use the tail
}

function dbgwrite(file, dotemps) {

    // manual config
    const dofollow = true;
    const doifstore = true;

    // just always do this for writing
    doallssb(body => crawlpurge(body));
    for (const i of Object.values(pifs)) {
        crawlpurge(i.tbody);
        crawlpurge(i.fbody);
    }
    const getv = (v) => {
        const id = typeof v == "object" ? v.idx : v;
        return `'${dbgvlkup[id]}'(${id})`;
    };
    const newans = {};
    for (const ns of Object.values(allns)) {
        newans[ns.name] = Object.values(ns.d).filter(v => v.type == "func");
    }
    // undo log, vaguely turns the AST back into very context missing string
    const unlog = [];
    const ulog = (txt) => {
        unlog.push(`${"\t".repeat(depth)}${txt}`); // " ".repeat(depth*4)
    };
    let depth = 0;
    const nestulog = (body) => {
        depth++;
        for (const instruct of body) {
            const {op} = instruct;
            if (op == "if") {
                ulog(`if ${instruct.id}, read ${getv(instruct.cond)}`);
                nestulog(instruct.tbody);
                ulog(`else for ${instruct.id}`);
                nestulog(instruct.fbody);
            } else if (op == "cond") {
                ulog(`cond ${instruct.id} (OLD INSTRUCT SHOULD NOT EXIST)`);
            } else if (op == "set") {
                ulog(`set ${getv(instruct)} to ${instruct.state ? "1" : "0"}`);
            } else if (op == "raw") {
                ulog(`raw commands [`);
                depth++;
                for (const line of instruct.lines) {
                    ulog(line);
                }
                depth--;
                ulog("]");
            } else if (op == "call") {
                ulog(`call ${instruct.target}`);
            } else if (op == "use") {
                ulog(`use (SHOULD NOT EXIST HERE)`);
                nestulog(instruct.body);
            } else if (op == "spread") {
                ulog(`spread (SHOULD NOT EXIST HERE)`);
                nestulog(instruct.body);
            } else if (op == "doif") {
                ulog(`doif ${instruct.id}`);
                const inst = pifs[instruct.id];
                if (!doifstore) {
                    depth++;
                    ulog(`if ${getv(inst.cond)} {`);
                    nestulog(inst.tbody);
                    ulog("}")
                    ulog("else {");
                    nestulog(inst.fbody);
                    ulog("}")
                    depth--;
                }
            } else if (op == "tempuse") {
                ulog(`templateuse ${instruct.idx}`);

            } else if (op == "setfollow") {
                ulog(`raw setfollow ${instruct.id} for ${instruct.escop}`);

            } else if (op == "escaped") {
                ulog(`escape via ${instruct.fromop} to follow ${instruct.id}`);
            } else if (op == "consedsetfollow") {
                ulog(`consumed setfollow ${instruct.id} for ${instruct.escop}`);
            } else if (op == "") {

            } else if (op == "") {

            } else if (op == "") {

            } else if (op == "") {

            } else if (op == "") {

            } else if (op == "") {

            } else if (op == "") {

            } else if (op === undefined) {
                ulog(`No op found; raw obj ${JSON.stringify(instruct)}`);
            } else {
                ulog(op);
            }
        }
        depth--;
    };
    const gulog = (v) => {
        if (v.type == "group") {
            ulog(`group`);
            depth++;
            for (const entry of v.data) {
                gulog(entry);
            }
            depth--;
        } else if (v.type == "bit") {
            ulog(`bit ${getv(v)} ${v.state ? "1" : "0"}`);
        } else if (v.type == "str") {
            ulog(`str ${getv(v.dbgid)} "${v.text}"`);
        } // else shouldn't happen
    };

    if (dotemps) {
        ulog("templates");
        depth++;
        for (let i = 0; i < ptemps.length; i++) {
            ulog(`template inst ${i}`);
            nestulog(ptemps[i]);
        }
        depth--;
    }

    if (dofollow) {
        ulog("all follow ups");
        for (const [id, body] of Object.entries(followups)) {
            ulog(`follow up ${id}`);
            nestulog(body);
        }
    }

    if (doifstore) {
        ulog("ifs");
        depth++;
        for (const i of Object.values(pifs)) {
            ulog(`if ${i.id}, read ${getv(i.cond)}`);
            nestulog(i.tbody);
            ulog(`else ${i.id}`);
            nestulog(i.fbody);
        }
        depth--;
    }

    for (const ns of Object.entries(allns)) {
        ulog(`ns ${ns[0]}`);
        depth++;
        for (const obj of Object.entries(ns[1].d)) {
            const {type} = obj[1];
            if (type == "func") {
                ulog(`func ${obj[0]}`);
                nestulog(obj[1].body);
            } else if (type == "bit") {
                ulog(`bit ${getv(obj[1])} ${obj[1].state ? "1" : "0"}`);
            } else if (type == "group") {
                gulog(obj[1]);
            } else if (type == "template") {
                // do nothing
            } else if (type == "str") {
                ulog(`str ${getv(v.dbgid)} "${v.text}"`);
            } else if (type == "") {

            } else if (type == "") {

            } else if (type == "") {

            } else if (type == "") {

            } else {
                ulog(`${obj[1].type} ${obj[0]}`);
            }
        }
        depth--;
    }
    fs.writeFileSync("./ast.json", safeStringify({pifs, newans}));
    fs.writeFileSync(file, unlog.join("\n"));
}



// chose to do this stuff here cus it's much more manually called in the compiler
/*GAME PLAN CUS THIS IS KINDA STRESSFUL
find an if, if we don't, it just ends cleanly
if find an if, then
    capture until the next if or we run out of space, IDEA
        new for loop that starts, and it breaks if it's an if and adds a trigger op
base if we find an if, add trigger op
okay actually, gonna have it just set a flag and then use the top for loop
ooo okay, so change of plans again, gonna be if capturing don't do i++ so it can consume
have realized I could make it find the first if and then go on, but this is still fine so
    not gonna go back and change it
realized also that I should kinda really just not do call always, since it would be able
    to always trace back at the final itd call and add em

OKAY ANOTHER IDEA, since multiple itd breaks, have it so ifs are marked as valid, and only
    the last on the upper most scope for the itd call isn't 




okay actual idea, ifs have a tcond and fcond, being what they lead into, still do tails,
    and escape characters both wipe rest of body and the cond, if an if has either cond,
    fill it in, if it doesn't, just leave it,



was gonna have a docond param but wouldn't even work really







*/

// new one
function itd(scope, tail = []) {

}

function doitd(scope, tail = []) {


    // actually does nothing rn cus I remove all ifs, but still return to be safe
    // TEMP OPTION
    return;


    let capturing = false;
    let store = []; // don't fill in trail because we always have to after
    let curr = null;
    let docond; // temp for migrating
    for (let i = 0; i < scope.length; capturing ? null : i++) {
        // purge nop, just cus
        if (capturing && scope[i].op != "if") {
            store.push(scope.splice(i, 1)[0]);
            continue;
        }
        // means before we're capturing, so before we found our first if
        if (scope[i].op != "if") continue;
        if (capturing) {
            // we found an if, so we can send our store up the chain and stuff
            // store a call to this next if
            doitd(curr.tbody, store);
            doitd(curr.fbody, store);
            // now handle this if we just found
            curr = scope[i];
            i++;
            store = [...tail];
        } else {
            // first capture really
            // insert a call to this first if
            capturing = true;
            curr = scope[docond ? i+1 : i];
            store = [...tail];
            // manually up bc next loop we're gonna consume and we inserted one
            if (docond) i+=2;
            else i++;
        }
    }
    // we got to the end of the scope instead of hitting another if/this was the last if
    if (capturing) {
        doitd(curr.tbody, store);
        doitd(curr.fbody, store);
    } else { // if this is false then we had no ifs here, will always chain down to hitting this
        // just add on the trail
        scope.push(...tail);
    }
}

// lazy check for spread to manually parse
function sprcheck(scope, i) {
    // just in case it somehow nests
    //let was = false;
    while(scope[i].op == "spread") {
        //was = true;
        //console.log("main", scope, "body", scope[i].body);
        const inst = scope[i];
        scope.splice(i, 1, ...inst.body);
    }
    //if (was) console.log("End", scope);
}

// might actually wanna combine escape and itd... hmmm

let followups = {};

// unused
function dofollows(scope) {

}



// wrapper/launcher/starter for crawlesc
function doesc(scope, op) {
    const id = tempnum();
    crawlesc(scope, op, id);
    // was unshift, but this is legit better
    scope.push({
        op: "setfollow",
        id,
        escop: op, // for debug tracing
    });
}

// crawler for escape ops
function crawlesc(scope, op, id) {
    for (let i = 0; i < scope.length; i++) {
        // only check if we don't nest, bc no nesting ops can logically be escape characters
        if (!_trycnest(crawlesc, scope[i], op, id) && scope[i].op == op) {
            scope.splice(i);
            // debug filler
            scope.push({
                op: "escaped",
                fromop: op,
                id
            });
            break; // just to be clean
        }
    }
}

// only for logging
function crawlpurge(scope) {
    for (let i = 0; i < scope.length;) {
        sprcheck(scope, i);
        const {op} = scope[i];
        if (["end", "iterend", "nop"].includes(op)) {
            scope.splice(i, 1);
        } else if (crawlprops[op]) {
            for (const prop of crawlprops[op]) {
                crawlpurge(scope[i][prop]);
            }
            i++;
        } else i++;
    }
}

// config/store of op to props with scopes
const crawlprops = {
    if: ["tbody", "fbody"],
    // no for, would both require hard coding cus it's an array and we do loops manually
    use: ["body"], // for initial, shouldn't matter after
    spread: ["body"], // was not gonna do spread, but thinking of edge cases you 100% have to
};


// calls cb(obj) with all funcs
function doallfunc(cb) {
    for (const ns of Object.values(allns)) {
        for (const entry of Object.values(ns.d)) {
            if (entry.type == "func") cb(entry);
        }
    }
}

function doallssb(cb) {
    for (const ssb of allssb()) {
        cb(ssb);
    }
}

// realized I defo want generator functions omg that's literally what these are forrrr

function* allfunc() {
    for (const ns of Object.values(allns)) {
        for (const entry of Object.values(ns.d)) {
            if (entry.type == "func") yield entry;
        }
    }
}

// all superscope bodies
function* allssb() {
    // do funcs
    for (const _ of allfunc()) {
        yield _.body;
    }
    // and templates
    for (const temp of ptemps) {
        yield temp;
    }
}


// crawl a scope cyclicly, if the current op is op, replaces it with cb(d)
function crawltrans(scope, op, cb) {
    for (const d of _crawl(scope, op)) {
        d.s[d.i] = cb(d);
    }
}



// made sprcheck to just do this automatically for some stuff

// crawltrans but just handles "spread" op, should be generally used directly with crawltrans
function crawlspread(scope) {
    for (const d of _crawl(scope, "spread")) {
        // remove the spread op
        d.s[d.i] = {op:"nop"};
        d.s.splice(d.i + 1, 0, ...d.v.body);
    }
    return scope;
}

// lazy internal function for crawling
// realized this should be a generator function, happy I get to use one
function* _crawl(scope, op) {
    for (let i = 0; i < scope.length; i++) {
        sprcheck(scope, i);
        if (scope[i].op == op) yield {v:scope[i],i,s:scope};
        // check after incase it changes it
        const curr = scope[i].op;
        if (crawlprops[curr]) {
            for (const prop of crawlprops[curr]) {
                for (const data of _crawl(scope[i][prop], op)) {
                    yield data;
                }
            }
        }
        // hard code this everywhere
        if (curr == "doif") {
            const inst = pifs[scope[i].id];
            for (const d of _crawl(inst.tbody, op)) {
                yield d;
            }
            for (const d of _crawl(inst.fbody, op)) {
                yield d;
            }
        }
    }
}

// lazy nester
function _trycnest(func, obj, ...params) {
    if (crawlprops[obj.op]) {
        for (const prop of crawlprops[obj.op]) {
            func(obj[prop], ...params);
        }
        return true;
    } else if (obj.op == "doif") {
        const inst = pifs[obj.id];
        func(inst.tbody, ...params);
        func(inst.fbody, ...params);
        return true;
    }
    return false;
}







// white spaces
const optwspace = /^\s*/;
const wspace = /^\s+/;
// I dont think I need this cus of parsing ! into []
//const newline = /^\s*\n/; // consumes up to next newline, only used on ! since only required newline (comments are consumed)

// general regexes
const token = /^[\w#%*]+/; //  eral tokenizer that accepts all possible strings
const stokens = ["-", "+", ".", ":"]; // single tokens
// next are used on the isolated g
const validword = /^[a-zA-Z_]\w*$/; // just funcs and templates really
const validtrigger = /^\w+$/; // for expose, technically could be * but + is technically right
const validtoken = /^[*%]?[#]?\w*$/; // seperate real token, you can tell why its separate (and it doesn't mean the combo exists/is valid)
const validvar = /^[*%]?[#]?[a-zA-Z_]\w*$/; // not all tokens are valid vars, but all vars are valid tokens
const rvcheck = /^[*%]?[a-zA-Z_]\w*$/; // real var check, can't be a compiler var
const cvcheck = /^[*%]?#[a-zA-Z_]\w*$/; // compiler var check
const pcheck = /^[#]?[a-zA-Z_]\w*$/; // param check, specifically is a param in a template
const numc = /^\d+$/; // used this so many times I just gotta make a const for it

// verifies the token isn't illegal, we capture like above to prevent trying to screw with the compiler
function checktoken(txt) {
    const res = validtoken.match(txt);
    if (!res) throw new TypeError(`Text "${txt}" failed token parser`);
}

// checks
const posint = (n) => {Number.isInteger(n) && n > 0};


// was gonna have a var for if we're global scope, but global scope is gonna be parsed differently
let curr = rawscript; // current string part being worked on (copies)
let cdat = [];
let tdat = cdat; // top data, used for issued json debugging
let cidx = 0;
let didx = 0; // not a counter, just current idx for when we throw an error to trace to
// was gonna have comment bools but strip comments makes that so easy
let ecloser = ""; // enclosing closer
let estart = ""; // starting encloser, used to up depth
let edepth = 0; // encloser depth
const closers = { // start to end symbols
    "(": ")",
    "<": ">",
    "[": "]",
    "{": "}"
}; // was gonna have a seperate for global enclosers then realized template means global uses all these
// gonna reserve like this cus you shouldn't use any names that are actual things, no matter
// what mainly got to realizing it would be you could do a function/template, but it would
// require using a namespace within itself so yeah no, though ig wouldn't but still
const keywords = [
    "use", "template", "func", "namespace", "global", "local",
    "var", "for", "set", "init", "copy", "U", "D", "else", "if",
    "call", "return", "expose", "globalinit", "break", "continue"
];

// actual data, the prior ones are ehh
let allns = {}; // all namespaces for accessing other namespaces
const exns = { // example for thinking
    name: "namespace name for ref",
    // was gonna be seperate for stuff, but its better to group funcs templates and vars to enable referencing them in compiler vars
    d: {}, // will be a universal across scopes, * prefixing a variable will tell it to reference this on currns instead of currscope
    // can't really think of anything else it would need

};
const exdataentry = { // example data entry in data
    type: "func|template|var", // was gonna have a copy, but copy can just JSON stringify the func it references
    val: "data obj", // was gonna have data on here, but for consistency gotta have it like this
};
let currns = null; // current namespace, used for global checks
let currscope = null; // current scope, was namespace, but scope will be more flexible for stuff, and will never be a namespace actually
let inits = []; // array of inits, will combine at some later step
let ginits = [];
let exposes = {}; // exposes, will be $2 $1 as the syntax, and include namespace, was about to put this in the namespace but realized becuase it doesn't care when being put into the game, it has to be here to prevent overlaps
let vstore = {}; // var store, as I was thinking of mkaing this I got the idea for how to do template insertions lazily, but all regular vars from parsevar get a value here
let tstore = {}; // template store, stores current template params, actually will have it as after a use, it resets it
let loops = []; // loop store for unrolling and doing continue and break
let ploops = [];
let ptemps = [];
let pifs = {};





function getname(name, usens) {
    return (usens ? currns : currscope).d[name];
}

function nameused(exists, name, usens) {
    const res = getname(name.val, usens);
    if (!exists && res) issue(name, `Name "${name.val}" is already on the current ${(usens ? "namespace" : "scope")}`);
    if (exists && !res) issue(name, `Name "${name.val}" does not exist on the current ${(usens ? "namespace" : "scope")}`);
    return res;
}

function expect(obj, prop, val) {
    if (obj[prop] != val) issue(obj, `Expected internal property "${prop}" to be "${val}", got "${obj[prop]}"`);
}

function want(bool, obj, msg) {
    if (!bool) issue(obj, msg);
}
function regexpect(reg, obj) {
    if (!reg.test(obj.val)) issue(obj, `Failed regex "${reg}"`);
    else return reg.test(obj.val);
}



function _vpbase(base) {
    let name = base.val;
    const start = name.startsWith.bind(name);
    let scope = true;
    // was gonna be the var object, instead just a sorta like, config ig
    const obj = {
        global: false,
        comp: false,
        param: false,
        name: null,
        type: "var",
        //token: base,
    };
    //console.log(name);
    if (start("*")) {
        scope = false;
        name = name.substring(1);
        obj.global = true;
    } else if (start("%")) {
        if (currscope.type != "template") issue(base, `Only templates can use "%" as it references their parameters, current scope type is "${currscope.type}"`);
        name = name.substring(1);
        obj.param = true;
    }
    // bc we modify it bind no longer is good
    if (name.startsWith("#")) {
        obj.comp = true;
    }
    obj.name = name;
    return obj;
}

// should all be seen as valid variable stuff by the time it does this stuff

let dbgvlkup = {};

// typing this as I gotta do the change to vars return objects, will be definition retursn a var, vref returns a reference, and groups hold references
// okay thinking about this, I might never need to return variable objects? oh wait yeah okay, I do for compiler var check, but ig could be a third function that more so just is _vpbase or just DO _vpbase directly
function parsevar(base, value) {
    const data = _vpbase(base);
    if (data.param) issue(value, `You can not declare a template parameter`);
    // build off of data
    if (value.t == "encloser") {
        if (data.comp) issue(value, `Compiler vars can not be var groups`);
        if (value.sym != "<") issue(value, `Only "<" can be used for var groups, got "${value.sym}"`);
        data.group = true;
        // ehh sure allow nesting var groups, was gonna not but it works fineee
        data.len = value.val.length;
        const gdata = value.val.map((v, idx) => {
            // realized I could do this a bit manually but this feels more proper and prolly easily expandable/flexible
            const newbase = dummytoken(base, `${base.val}_${idx}`);
            // get the val of it bc we don't need the base ref
            return parsevar(newbase, v); // can only be a regular var bc the name WE pass
        });
        data.val = {
            type: "group",
            data: gdata,
            len: {
                type: "num",
                num: gdata.length
            }
        }
    } else {
        data.group = false;
        if (data.comp) {
            if (numc.test(value.val)) {
                // direct num
                const val = parseInt(value.val);
                data.val = {
                    type: "num",
                    num: val
                };
            } else if (value.t == "nsget") {
                const res = tryns(value);
                /* gonna be tryns gets the var's value
                if (res.type == "var") {
                    if (!res.comp) issue(value, `Compiler vars can not reference non-compiler vars`);
                    data.val = res.val; // point to their value, since they never change and bc its nesting, we would already be pointing at em
                }*/
               data.val = res;
            } else if (value.t == "token") {
                // would work for Wl always bc it can reference any of those
                const res = wlparse(value);
                data.val = res;
            }
        } else {
            // must be a regular var
            // kinda questioning myself making strings regular vars, but doing it so you dont need all the # prefixes and it just should be fineee
            // was gonna soft issue it but meh rn and ig just here
            //match(value, "B") || value.t == "string" || issue(value, `Only bits or strings can be assigned to regular variables, expected "0" or "1" and got "${value.val}"`);
            if (match(value, "B")) {
                const state = value.val == "1";
                const id = tempnum();
                const entry = {
                    type: "bit",
                    idx: id,
                    state
                };
                dbgvlkup[id] = data.name;
                data.val = entry;
                vstore[id] = entry;
            } else if (value.t == "string") {
                // parse references
                const {refs} = value;
                let {val} = value;
                // map for quick index access
                refs.map((v, i) => {
                    const out = parsevref(v);
                    // trace SHOULD be proper, but might be screwed
                    if (out.type != "str") sissue(v, `Expected type "str" for insertion, got type "${out.type}"`);
                    val = val.replace(`@${i}@`, out.text);
                });
                // only for backref
                data.val = {
                    type: "str",
                    text: val,
                    dbgid: tempnum(),
                };
                dbgvlkup[data.val.dbgid] = data.name;
            } else issue(value, `Only bits or strings can be assigned to regular variables, expected "0", "1", or a string, and got type "${value.t}" with value "${value.val}"`);
        }
    }
    return data.val;
}

// realized I should have a seperate for this and just have it wrap
function tryns(obj) {
    if (obj.t == "nsget") {
        expect(obj.namespace, "t", "token");
        expect(obj.label, "t", "token");
        const ns = allns[obj.namespace.val];
        if (!ns) issue(obj.namespace, `Namespace "${obj.namespace.val}" does not exist`);
        const val = ns.d[obj.label.val];
        if (!val) issue(obj.label, `Label "${obj.label.val}" does not exist on namespace "${obj.namespace.val}"`);
        return val;
    } else return obj; // this is just a wrapper so we don't care about any other types
}

// parser for Wl, wants to return a reference to a real object, not CST data
function wlparse(obj) {
    if (obj.t == "nsget") return tryns(obj);
    if (obj.t == "token") {
        if (match(obj, "W")) {
            // we want to try to get this from the current namespace
            // nameused will error for us if it's invalid
            return nameused(true, obj, true);
        }
        if (match(obj, "V")) {
            const vari = parsevref(obj, true); // must be a compiler var
            return vari;
        }
    }
}

function parsevref(obj, forcecomp) {
    obj = tryns(obj);
    // all other's will boil down to most of the time calling again and it going into the token case
    if (obj.t == "token") {
        const data = _vpbase(obj);
        let vari;
        if (data.global) vari = nameused(true, dummytoken(obj, data.name), true);
        //if (data.global) console.log(vari);
        else if (data.param) {
            if (!currscope?.type == "template") issue(obj, `Only templates can have parameters, currscope is "${currscope?.type}"`);
            const label = obj.val.substring(1);
            vari = currscope.params[label];
            //console.log(vari);
            if (!vari) issue(obj, `Parameter "${label}" does not exist on this template, template params:${JSON.stringify(currscope.params)}`);
        } else vari = nameused(true, dummytoken(obj, data.name), false);
        if (forcecomp && vari.type == "group") return vari.len; // do group coercion
        if (forcecomp && !data.comp) issue(obj, `Expected a compiler variable`);
        /* params auto map
        if (data.param) {
            // need to make sure it exists and such, already verified this is a template in _vpbase
            if (!currscope.params[data.name]) issue(obj, `Parameter does not exist on template`);
        } else vari = nameused(true, data.name, false);
        */
        return vari;//.val;
    } else if (obj.t == "groupget") {
        if (forcecomp) issue(obj, `Expected a compiler var, got a group access instead`);
        // base and prop
        // base has to be a nsget groupget or token, prop always token, number or compiler var
        const base = parsevref(obj.base, false);
        // was gonna do a !base check but we already throw if it wasn't a variable so this is fine
        if (!base.type == "group") issue(obj.base, `Only variable groups can be accessed with "."`);
        // was gonna expect token, but parsevref for combiners, actually no bc of ordering that doesn't work, prolly should change that around
        expect(obj.prop, "t", "token");
        // reusing accessor as the number object is gonna be really clean
        let acc; // accessor
        if (numc.test(obj.prop.val)) {
            // a number, direct access
            const num = parseInt(obj.prop.val);
            // don't need to check <0 bc numc doesn't allow - (would be a seperate token aswell)
            //if (num >= base.len) issue(obj.prop, `Group "${base.name}" only has ${base.len} entries, wanted index ${num}`);
            acc = {
                type: "num",
                num: num
            };
        } else {
            const prop = parsevref(obj.prop, true); // has to be a compiler var
            acc = prop;
        }
        //console.log(obj.prop);
        //console.log(acc);
        //console.log(nameused(true, obj.prop, false));
        expect(acc, "type", "num");
        if (acc.num >= base.len.num) issue(obj.prop, `Group "${obj.base.val}" only has "${base.len.num}" entries, wanted index "${acc.num}"`);
        return base.data[acc.num];
    } else if (obj.t == "combiner") {
        // pre and aft, pre can be a few things, but ends as a compiler var, aft can be compiler var or number
        // can't guarentee pre type but aft can only be a number or compiler var
        expect(obj.aft, "t", "token");
        const pre = parsevref(obj.pre, true);
        let aft;
        //let type;
        if (numc.test(obj.aft.val)) {
            aft = {
                type: "num",
                num: parseInt(obj.aft.val)
            };
        } else {
            aft = parsevref(obj.aft, true);
        }
        // gonna expect stuff here now bc migrating to the return stuff philosophy
        expect(aft, "type", "num");
        expect(pre, "type", "num");
        let out = obj.sym == "+" ? pre.num + aft.num : pre.num - aft.num;
        if (out < 0) issue(obj, `Result of a combiner can not be negative, got "${out}"`);
        return {
            type: "num",
            num: out
        };
    }
}

// dummy CST object maker to map tokens to themselves for stuff like for loop vars
const dummytoken = (base, val) => ({
    idx: base.idx,
    eidx: base.eidx,
    t: "token",
    val
});

// when starting to make these I considered making a toString method on all the stuff, but it's fineee
// NOTE ON INTENT: base token objects from CST should not be still there after patterns
const gpats = {
    namespace: {
        args: ["W"],
        exec(nsobj) {
            const ns = nsobj.val;
            if (allns[ns]) issue(ns.length, `Namespace "${ns}" already exists`);
            const obj = {
                name: ns,
                d: {}
            };
            allns[ns] = obj;
            // kinda tempted to set currentscope, would let global use the base variable pattern, and it sorta would work with all I understand about what I've done
            currns = obj;
            // yeahh setting currscope cus var groups
            currscope = obj;
            // was gonna return but we can have it all parse onto the ns object
        }
    },
    copy: {
        args: ["W", "W"],
        exec(name, from) {
            const base = nameused(true, name, true);
            nameused(false, from, true);
            currns.d[name.val] = JSON.parse(JSON.stringify(base));
        }
    },
    template: {
        args: ["W", "E(", "E{"],
        exec(name, rargs, script) {
            nameused(false, name, true);
            // args is for mapping order of params
            const args = [];
            const params = {};
            for (let arg of rargs.val) {
                expect(arg, "t", "token");
                const name = arg.val;
                if (!pcheck.test(name)) issue(arg, `Not a valid parameter`);
                // pcheck already verified it for us
                args.push(name);
                // realized params mean I don't need tstore, bc it references up and if you do cyclic we can just error bc that's a forever loop
                // we'll also be doing the whole dont pass a regular var as a compiler var via uh, well you have to do %#param, and that # means it can't be a regular var even if you passed one... cus fields don't overlap :D
                params[name] = null;
            }
            const scope = {
                type: "template",
                d: {},
                args,
                params,
                using: false, // cyclic detection
                ns: currns.name // for when you reference another namespace's stuff
            };
            // do lazy loading
            scope.script = script.val;
            currns.d[name.val] = scope;
        }
    },
    func: {
        args: ["W", "E{"],
        exec(name, script) {
            nameused(false, name, true);
            const scope = {
                type: "func",
                d: {}
            };
            currscope = scope;
            // self referencing
            currns.d[name.val] = scope;
            const body = doPatterns(script.val, fpats, "super");
            currscope = currns; // reset to namespace
            body.push({op:"end"});
            scope.body = body;
        }
    },
    global: {
        args: ["V", "VV"], // can be alot cus compiler vars
        exec(name, val) {
            nameused(false, name, true);
            currns.d[name.val] = parsevar(name, val);
        }
    },
    init: {
        args: ["E["],
        exec(body, _) {
            issue(_, "Init is currently not avaliable in this early release of the compiler, as detecting when a bot ain't here to reinitalize is a bit tricky :/");
            inits.push(...body.val);
        }
    },
    globalinit: {
        args: ["E["],
        exec(body) {
            ginits.push(...body.val);
        }
    },
    expose: {
        args: ["W", "t"],
        exec(name, trigger) {
            const func = nameused(true, name, true);
            expect(func, "type", "func");
            expect(trigger, "t", "token");
            if (exposes[trigger.val]) issue(trigger, `This is used by another expose, trigger names can not overlap`);
            exposes[trigger.val] = func;
        }
    }
};
const spats = {
    set: {
        args: ["Rv", "B"], // you can only set regular vars to bits, compiler vars can't be changed (except for the internal thing for for loops)
        exec(name, state) {
            nameused(false, name, false);
            const vari = parsevref(name, false);
            if (vari.comp) issue(name, `Compiler vars can not be used for setting`);
            if (vari.group) issue(name, `Variable groups can not be used directly for setting`);
            return {
                op: "set",
                idx: vari.idx,
                state: state.val == "1"
            }
        }
    },
    call: {
        args: ["Wl"],
        exec(name) {
            const func = wlparse(name);
            expect(func, "type", "func");
            // don't make it pas a reference since that can be a cylic object (as I found out)
            // actually do, I got a safeStringify and actually amkes it impossible to tell :))))))
            return {
                op: "call",
                target: func,
                //token: name
            }
        }
    },
    use: {
        args: ["Wl", "E("],
        exec(name, params) {
            const temp = wlparse(name);
            if (temp.inuse) issue (name, `Cyclic template usage detected`);
            temp.inuse = true; // cyclic detection
            // var's are converted by wlparse
            expect(temp, "type", "template");
            const args = [];
            // was gonna let you pass numbers, but will be you can only pass variables
            for (const param of params.val) {
                const vari = parsevref(param, false);
                args.push(vari);
            }
            if (args.length != temp.args.length) issue(params, `Template "${name.val}" has "${temp.args.length}" args, got "${args.length}"`);
            const pstore = clone(temp.params);
            for (let i = 0; i < args.length; i++) {
                temp.params[temp.args[i]] = args[i];
            }
            const scopestore = currscope;
            currscope = temp;
            const nsstore = currns;
            currns = allns[temp.ns];
            const body = doPatterns(clone(temp.script), tpats, "super");
            temp.inuse = false; // reset the flag
            temp.params = pstore;
            currscope = scopestore;
            currns = nsstore;
            return {
                op: "use",
                body
            };
        }
    },
    for: {
        args: ["E(", "E{"],
        exec(rcfg, script) {
            expect(rcfg.val, "length", 2);
            const vname = rcfg.val[0];
            // should never be on the current scope, prevents either reusing an existing for loop var or using an existing compiler var
            nameused(false, vname, false);
            regexpect(cvcheck, vname);
            // parse the args
            let cfg = {};
            if (match(rcfg.val[1], "E(")) {
                cfg.type = "manual";
                const params = rcfg.val[1].val;
                // [start, end, step, dir], first 2 are required, first 3 are numbers, dir is U or D
                if (params.length < 2 || params.length > 4) issue(rcfg.val[1], `For loop configs must have 2 to 4 parameters, got "${params.length}"`);
                const [rs, re, rst, rd] = params;
                const forcheck = (tok, label) => {
                    let out;
                    // so it doesn't error if it fails
                    // old, didn't seem to work
                    if (!tok.val || !numc.test(tok.val)) out = parsevref(tok, true);
                    // res is undefined if it errored meaning couldn't get a compiler var
                    out ??= {
                        type: "num",
                        num: parseInt(tok.val)
                    };
                    want(out, tok, `For loop cfg ${label} must be a number or compiler var`);
                    cfg[label] = out;
                };
                forcheck(rs, "start");
                forcheck(re, "end");
                if (rst) forcheck(rst, "step");
                else cfg.step = {
                    type: "num",
                    num: 1
                }
                if (rd && !["U", "D"].includes(rd.val)) issue(rd, `Expected "U" or "D" for direction, got "${rd.val}"`);
                cfg.dir = (rd?.val ?? "U") == "U" ? true : false;
            } else {
                cfg.type = "group";
                const ref = parsevref(rcfg.val[1]);
                if (!ref.type == "group") issue(rcfg.val[1], `Expected a variable group or for loop config`);
                cfg.target = ref;
            }
            const bodies = [];
            // flag for break and continue, if you use a template, due to this being on currscope, conts and breaks can't escape
            const inloopstore = currscope.inloop; // incase outside is also a for loop
            currscope.inloop = true;
            if (cfg.type == "group") {
                // parsevref returns a group, not a variable pointing to a group
                for (let idx in cfg.target.data) {
                    currscope.d[vname.val] = {
                        type: "num",
                        num: idx
                    };
                    const body = doPatterns(clone(script.val), spats);
                    body.push({op:"iterend"});
                    bodies.push(body);
                }
            } else {
                const stepper = cfg.dir ? (i) => i+cfg.step.num : (i) => i-cfg.step.num;
                const ender = cfg.dir ? (i) => i < cfg.end.num : (i) => i >= cfg.end.num;
                for (let i = cfg.start.num; ender(i); i = stepper(i)) {
                    currscope.d[vname.val] = {
                        type: "num",
                        num: i
                    };
                    const body = doPatterns(clone(script.val), spats);
                    body.push({op:"iterend"});
                    bodies.push(body);
                }
            }
            currscope.d[vname.val] = null;
            currscope.inloop = inloopstore; // reset
            loops.push(bodies);
            return {
                op: "for",
                idx: loops.length - 1
                //bodies
                // was gonna save vari and cfg but can't think of a reason to need to
            }
        }
    },
    break: {
        args: [],
        exec(token) {
            if (!currscope.inloop) sissue(token, `Break can only be used inside loops`);
            return {op:"break"};
        }
    },
    continue: {
        args: [],
        exec(token) {
            if (!currscope.inloop) sissue(token, `Break can only be used inside loops`);
            return {op:"continue"};
        }
    },
    return: {
        args: [],
        exec() {
            return {op:"return"};
        }
    },
    if: {
        args: ["Rv", "E{", "K", "E{"],
        exec(vari, script, _, escript) {
            const val = parsevref(vari);
            // just gonna expect a bit
            expect(val, "type", "bit");
            const body = doPatterns(script.val, spats);
            body.push({op:"end"});
            const ebody = doPatterns(escript.val, spats);
            ebody.push({op:"end"});
            return {
                op: "if",
                cond: val.idx,
                tbody: body,
                fbody: ebody,
                id: tempnum(), // for calling ifs
                // took a while, but ai said this is kinda literally how cpus work, I think it mighta misunderstood me, but this should work
                // called em tcond and fcond in the relevant ai convo, cus they're cond instructions/would of been them, but this is clearer
                // okay was gonna not use em, but realized again why I should defo use this
                tgo: null,
                fgo: null
            };
        }
    }
};
const varicfg = {
    args: ["V", "VV"],
    exec(name, val) {
        nameused(false, name, false);
        const curr = parsevar(name, val);
        currscope.d[name.val] = curr;
        return {
            op:"set",
            idx: curr.idx,
            state: curr.state
        };
    }
};
const fpats = {
    var: varicfg
};
const tpats = {
    local: varicfg
};


// add scope patterns to func and templates for ease of access
for (const start in spats) {
    const val = spats[start];
    fpats[start] = val;
    tpats[start] = val;
}

// IMPORTANT, I changed my mind on this to this will also compile the data into stuff so its actually easier, mainly so it can manipulate data


function patiss(obj, text, override) {
    issue(obj, `${text}, full obj data: ${JSON.stringify(override ?? obj)}`);
}

// store for if unrolling
let allscopes = []; // funcs and templates (others are all gotten dynamically)
function doPatterns(data, pats, scopetype) {
    const store = [];
    if (scopetype == "super") {
        allscopes.push(store);
    }
    while (data.length > 0) {
        const next = data.shift();
        // check if this is just a [ for raw command insertions bc it can go anywhere between instructions
        if (match(next, "E[")) {
            // manually check
            // soft issue bc one of the only times we for sure can continue, will try to use soft issue in more places
            if (pats == gpats) {
                sissue(next, `Raw command insertions are not allowed in the global scope`);
                continue;
            }
            // gotta parse, val[].val is text, val[].refs is refs, val[] is lines
            const newlines = [];
            for (const line of next.val) {
                let txt = line.val;
                line.refs.map((v, i) => {
                    const out = parsevref(v);
                    if (out.type != "str") sissue(`Expected internal type "str", got "${out.type}"`);
                    txt = txt.replace(`@${i}@`, out.text);
                });
                newlines.push(txt);
            }
            store.push({
                op: "raw",
                lines: newlines
            });
            continue;
        }
        if (!match(next, "K")) patiss(next, `Got token type "${next.t}", expected type keyword`);
        const pat = pats[next.val];
        if (!pat) issue(next, `COMPILER ISSUE: Keyword "${next.val}" does not exist! Please tell the developer they made a mistake!`);
        const args = [];
        let gotstar = false;
        if (data.length < pat.args.length) issue(next, `Not enough arguments for keyword "${next.val}", expected ${pat.args.length} and found ${data.length}`);
        for (const apat of pat.args) {
            if (gotstar) issue(next, `COMPILER ISSUE: Pattern for keyword "${next.val}" has a * argument as not the lsat argument, which is not possible to parse, please tell the developer to fix this!`);
            const arg = data.shift();
            if (apat == "*") {
                gotstar = true;
                while (data.length > 0 && !match(data[0], "K")) {
                    args.push(data.shift());
                }
                continue;
            }
            if (!match(arg, apat)) patiss(arg, `Keyword "${next.val}" got "${arg.val}", which is not "${matchlabels[apat]}"`, arg);
            args.push(arg);
        }
        // added for continue and break, pass the keyword token as a final "arg"

        let res;
        if (pat.exec) {
            res = isswrap(false, pat.exec, ...args);
            if (res.success) store.push(res.res);
            else {
                sissue(next, res.msg);
                store.push({
                    op: "ERR"
                });
            }
        }
    }
    // was gonna push a meta op for end of scope, but gonna have everything that uses
    // doPatterns do that instead, because then its specific ops and for each that needs to
    // do something we can make em check on their own
    return store;
}


// might NOT use all this and instead just use parsevref



let currcbv = null;
function cbvno(msg) {
    return false;
    // was gonna do this, but nvm mmmm
}


// gotta check alot cus nsget and groupget
// for Rv and v
// really kidna gotta actually make this oooo
function canbevar(obj, regex) {
    currcbv = obj;
    let baseres = (obj.t == "token" && regex.test(obj.val));
    if (baseres) return true;
    if (obj.t == "nsget") {
        if (obj.namespace.t != "token") return cbvno();
    } else if (obj.t == "groupget") {
        if (obj.prop.t != "token") return cbvno();
        if (!["token", "nsget", "groupget"].includes(obj.prop.t)) return cbvno();
    } else if (obj.t == "string") {
        return true; // just do this cus yeah
    } else {
        didx = obj.idx;
        return cbvno(`Type "${obj.t}" can't be a variable`);
    }
    return true;
}


const matchlabels = {
    T: "token",
    K: "keyword",
    "E(": "Encloser (",
    "E{": "Encloser {",
    "E[": "Encloser [",
    "E<": "Encloser <",
    V: "Variable",
    v: "Variable reference",
    Rv: "Real variable reference",
    W: "Word",
    t: "Trigger",
    B: "Bit",
    VV: "Variable Value",
    Wl: "Loosely a word",
};


function match(obj, pat) {
    const type = obj.t;
    const check = pat[0];
    // almsot went insane then realized VV WAS CHECKING check and SO WAS V SO IT CAUGHT VV AND AHHHHHH
    if (check == "T") {
        return type == "token";
    } else if (check == "K") {
        return type == "keyword";
    } else if (check == "E") {
        if (type != "encloser") return false;
        return obj.sym == pat[1];
    } else if (pat == "V") {
        return type == "token" && validvar.test(obj.val);
    } else if (check == "v") {
        return canbevar(obj, validvar);
    } else if (pat == "Rv") {
        return canbevar(obj, rvcheck);
    } else if (pat == "W") {
        return type == "token" && validword.test(obj.val);
    } else if (check == "t") {
        return type == "token" && validtrigger.test(obj.val) && (
            // almost debated not doing this but meh its fine
            !obj.val.startsWith("_crs_") ||
            (
                didx = obj.idx,
                // was gonna set eidx and throw but js, or atleast intellisense, gets mad if I use throw in here
                issue(5, `Triggers can not start with "_crs_" as the compiler reserves it for internal use`)
            )
        );
    } else if (check == "B") {
        return type == "token" && (["0", "1"].includes(obj.val));
    } else if (pat == "VV") {
        // check all the stuffs
        return canbevar(obj, validvar) ||
        (obj.t == "token" && validtoken.test(obj.val)) ||
        (obj.t == "encloser" && obj.sym== "<" &&
            (didx = obj.idx, edidx = obj.eidx, obj.val.every(v => match(v, "VV")))
        ) || obj.t == "combiner";
    } else if (pat == "Wl") {
        return match(obj, "W") ||
        (obj.t == "token" && cvcheck.test(obj.val)) ||
        (obj.t == "nsget" && tryns(obj))
    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    } else if (check == "K") {

    }
}

// flag system
const tflags = {

};

const is = (obj, flag) => tflags[obj.v].includes(flag);


// IMPORTANT, need to fix comment so you cant do //*/ and have */ be removed
function cleanText() {
    // originially had my own of these two but then realized I need to preserve the count so ai helped me with this
    // Remove multiline comments but keep every newline character found inside
    curr = curr.replaceAll(/\/\*[\s\S]*?\*\//g, (match) => {
        return match.split('\n').map(line => " ".repeat(line.length)).join('\n');
    });
    // Remove single line comments but keep the newline (\n)
    curr = curr.replace(/\/\/.*$/gm, (match) => " ".repeat(match.length));
    // ty gemini
    // Regex: Find !, then capture everything until the newline or end of file
    // Replace using the first group (the command content)
    curr = curr.replace(/!(.*)$/gm, (match, commandContent) => {
        return `[${commandContent.trim()}]`; // was a \n, but if we have \n it turns "!...n" into "[...]n" thus offsetting text truth
    });
}2

// returns {val, refs}, refs is array of replacer values
function parseStr(str) {
    const refs = [];
    let val = "";
    let capping = false;
    let capped = "";
    while (str.length > 0) {
        if (capping) {
            if (str[0] == "}") {
                capping = false;
                str = str.slice(1);
                cidx++;
                // kinda questionable, but works
                const rcurr = curr;
                const rcdat = cdat;
                cdat = [];
                curr = capped;
                parseText();
                // polishParse makes it so theres no actual case that isn't 1 length
                if (cdat.length != 1) throw new TypeError(`Got "${cdat.length}" token count at insertion ${refs.length + 1}, should be 1`);
                // bc we haven't pushed yet we don't need to do length - 1
                val += `@${refs.length}@`;
                refs.push(cdat[0]);
                //cidx = ridx;
                curr = rcurr;
                cdat = rcdat;
            } else {
                // capture the token
                capped += str[0];
                str = str.slice(1);
                cidx++;
            }
        } else if (str[0] == "{") {
            capping = true;
            capped = "";
            str = str.slice(1);
            cidx++;
        } else if (str[0] == "}") {
            throw new TypeError(`Found } in string without matching {`);
        } else {
            val += str[0];
            str = str.slice(1);
            cidx++;
        }
    }
    if (capping) throw new TypeError(`Unclosed { in string`);
    return {val, refs};
}
// I started using curr.shift then remebered curr isn't an array
function cshift() {
    const ret = curr[0];
    curr = curr.slice(1);
    return ret;
}

const looklog = [];

// syntax analysis, first parse it into easily checkable data
// does tokenization/making a CST (Concrete Syntax Tree)
function parseText() {
    // consume starter whitespace
    consows();
    while (curr.length > 0) {
        // for funny
        looklog.push(curr.replace(/\s+/g, " ").substring(0, 80));
        // check if we need to enclose
        const closer = closers[curr[0]];
        // check to LAZILY enclose strings
        if (curr[0] == '"') {
            let str = "";
            const sidx = cidx;
            didx = sidx;
            cshift();
            cidx++;
            // no \ escape bc you can't use " in a console command
            while (curr[0] != '"') {
                edidx = cidx;
                if (curr.length == 0) throw new TypeError("Ran out of script trying to enclose \"");
                // can't be @ as we use that for parseStr
                if (curr[0] == "@") throw new TypeError("Strings can not contain @");
                str += cshift();
            }
            cshift(); // remove end "
            edidx = cidx;
            const {val, refs} = parseStr(str);
            // add for end " now
            cidx++;
            // was gonna use token type but defo should be seperate
            const data = {
                t: "string",
                idx: sidx,
                eidx: cidx,
                val,
                refs
            };
            cdat.push(data);
        } else if (closer) {
            // omg using globals, I think that if it ever nested and didnt end in the same encloser, it would break? idk something weird would be happening so ugghhhh
            const start = curr[0];
            estart = curr[0];
            ecloser = closer;
            let newtxt = "";
            edepth = 1;
            curr = curr.slice(1);
            let added = 0; // count only for [ enclosers
            while (true) {
                if (curr.length == 0) throw new TypeError(`Ran out of script trying to close ${estart}`);
                if (curr[0] == ecloser) {
                    // check this first
                    edepth--;
                    if (edepth == 0) break; // do this here cus no point in the while loop doing it
                }
                if (curr[0] == estart) edepth++;
                added++;
                newtxt += cshift();
            }
            cshift(); // remove the ending encloser
            // add for the encloser start
            cidx++;
            // save em (called real)
            const rcurr = curr;
            const rcdat = cdat;
            const startidx = cidx;
            curr = newtxt;
            cdat = [];
            // kinda very after making the rest of this I'm doing this, got to making the op raw and realized I need to not tokenify the [ encloser
            if (estart == "[") {
                didx = startidx;
                cidx += added;
                edidx = cidx;
                // kinda lazy still doing all the prior stuff but meh
                const lines = curr.split("\n").map(l => l.trim()).filter(l => l.length > 0);
                // was gonna have a new property, but betetr to just shove it in val
                cdat = lines.map((v, i) => {
                    if (v.includes("@")) throw new TypeError(`Raw command insertions can not contain @, found one at insertion line ${i+1}`);
                    return parseStr(v);
                });
            }
            else parseText();
            const data = {
                t: "encloser",
                sym: start,
                val: cdat,
                idx: startidx,
                eidx: cidx,
            };
            // add for the encloser end
            cidx++;
            curr = rcurr;
            cdat = rcdat;
            cdat.push(data);
        } else {
            if (stokens.includes(curr[0])) {
                cdat.push({
                    t: "token",
                    val: curr[0],
                    idx: cidx,
                    eidx: curr[0].length + cidx
                });
                curr = curr.slice(1);
                cidx++;
            } else {
                const res = token.exec(curr);
                didx = cidx;
                edidx = cidx;
                if (!res) throw TypeError(`Failed parsing when ${curr.length} symbols were left, "${curr}"`);
                curr = curr.slice(res[0].length);
                if (keywords.includes(res[0])) {
                    cdat.push({
                        t: "keyword",
                        val: res[0],
                        idx: cidx,
                        eidx: res[0].length + cidx
                    });
                } else {
                    cdat.push({
                        t: "token",
                        val: res[0],
                        idx: cidx,
                        eidx: res[0].length + cidx
                    });
                }
                // then add index
                cidx += res[0].length;
            }
        }
        // consume any after
        consows();
    }
    polishParse();
}

// constants for polishing
const combiners = ["-", "+"];
// was gonna do this but hardcoding is fine
const gaccessor = ".";
const nsaccessor = ":";

function hasroom(idx) {
    haspre(idx);
    hasaft(idx);
}

function haspre(idx) {
    if (idx == 0) throw new TypeError(`Found symbol "${cdat[i]}" with no room before`);
    
}

function hasaft(idx) {
    if (idx == cdat.length - 1) throw new TypeError(`Found symbol "${cdat[i]}" with no room after`);
}


// should be only on not global scope but yeah
function polishParse() {
    // some passes, have to do suffixes and prefixes before combiners
    // no increaser for a reason
    for (let i = 0; i < cdat.length;) {
        if (nsaccessor == cdat[i].val) {
            setidxs(cdat[i]);
            hasroom(i);
            const ns = cdat[i-1];
            const part = cdat[i+1];
            cdat[i] = {
                t: "nsget",
                namespace: ns,
                label: part,
                idx: ns.idx,
                eidx: part.eidx // had a check for if the prop had eidx, but now made all CST parts have eidx
            };
            cdat.splice(i+1, 1);
            cdat.splice(i-1, 1);
            continue;
        }
        // was gonna not remove the prior, but just combining works better :/
        if (gaccessor == cdat[i].val) {
            setidxs(cdat[i]);
            hasroom(i); // used to be hasaft, only reason checks are seperate
            const prop = cdat.splice(i+1, 1)[0];
            const base = cdat.splice(i-1, 1)[0];
            // we're now back by one
            cdat[i-1] = {
                t: "groupget",
                base,
                prop,
                idx: base.idx,
                eidx: prop.eidx
            };
            continue;
        }
        i++;
    }
    for (let i = 0; i < cdat.length;) {
        if (combiners.includes(cdat[i].val)) {
            setidxs(cdat[i]);
            hasroom(i);
            const sym = cdat[i].val;
            const pre = cdat[i-1];
            const aft = cdat[i+1];
            cdat[i] = {
                t: "combiner",
                sym,
                pre,
                aft,
                idx: pre.idx,
                eidx: aft.eidx
            };
            cdat.splice(i+1, 1);
            cdat.splice(i-1, 1);
            // we removed an index behind us so we're ahead one already
            continue;
        }

        i++; // only if it gets here
    }
}



// consumers
// optional whitespace
function consows() {
    const res = optwspace.exec(curr);
    if (res) cidx += res[0].length;
    curr = curr.replace(optwspace, "");
}
// 
function constoken() {

}





if (!islsp && !runbuilt) compile();
else if (!islsp && runbuilt) startBuilt();