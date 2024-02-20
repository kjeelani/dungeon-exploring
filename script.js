var Deque = require("double-ended-queue");

let dungeon_tree = {};
let aiMap = "";
let metrics = {};
let playerSteps = "";
let success = false;
let DEBUG = true;

function startGame() {
    var startButton = document.getElementById("start_game");
    var gameSection = document.getElementById("game");
    var current_steps_text = document.getElementById("current_level");
    var human_info_text = document.getElementById("human_info")


    function getDefaultMetrics() {
        return {
            "numRooms": 0,
            "numDangers": 0,
            "numHiddenDangers": 0,
            "shortestPathLength": 0,
            "playerFollowPercentage": 0, // How often did the player follow the AI
            "success": false,
            "diedByHiddenDanger": false
        }
    }

    while (aiMap === "") {
        metrics = getDefaultMetrics();
        dungeon_tree = generateDungeonTree();
        aiMap = generateAIMap(dungeon_tree);
        updateAIMapText();
    }
    playerSteps = "";
    success = false;

    // console.log(dungeon_tree);
    // console.log(metrics);

    current_steps_text.textContent = "Current Steps: None";
    human_info_text.textContent = dungeon_tree["humanWarning"];

    startButton.style.display = "none";
    gameSection.style.display = "block";
}

function coinFlip(p) {
    /* Returns True if a p-weighted coin is flipped heads and false otherwise*/
    return Math.random() < p
}

function generateDungeonTree() {
    /*
        Generates a dungeon tree in the form:
        {
            0: {0:..., 1:..., 2:...},
            1: {0:..., 1:..., 2:...},
            2: {0:..., 1:..., 2:...}
        } 
        Where 0 is left, 1 is middle, and 2 is right.

        Every time a tunnel is crossed, endP represents the probability
        of that crossing being the exit. This probability grows greater 
        and greater the further the subtree.

        dangerP and hiddenDangerP represent the chance that the tunnel leads
        to a known or hidden danger. Known dangers can be detected by the 
        AI map, while hidden dangers cannot.
    */
    let starting_endP = .005;
    let scaling_endP = 1.5;
    let dangerP = .2;
    let hiddenDangerP = .1;

    function generateTunnel(end, danger, hiddenDanger) {
        return {
            0:-1, 
            1:-1, 
            2:-1, 
            "end": end, 
            "danger": danger, 
            "hiddenDanger": hiddenDanger,
            "humanWarning": ""
        }
    }

    function generateHumanText(dangerIndex) {
        /*
            Generates two directions that the human NPC
            thinks could be dangerous. One of them is guarenteed
            to be dangerous.

            Output: A string in the form "<dir1> and <dir2>"
        */
        let dirArr = ["left", "middle", "right"];
        let retArr = [
            dirArr.splice(dirArr.indexOf(dangerIndex), 1)[0],
            dirArr.splice(Math.floor(Math.random() * 2), 1)[0]
        ]
        // Randomizing the order so it's not predictable
        return `${retArr.splice(Math.floor(Math.random() * 2), 1)[0]} and ${retArr[0]}`
    }

    function generateSubTree(cur_endP, depth) {
        // TODO: Not efficient because on dangers we still generate subtrees
        metrics["numRooms"] += 1
        if (depth > 14 || coinFlip(cur_endP)) {
            metrics["numRooms"] += 1
            return generateTunnel(true, false, false);
        }
        let subTree = generateTunnel(false, false, false);
        // Generate all subtrees
        for (let i = 0; i < 3; i++) {
            if (coinFlip(dangerP)) {
                subTree[i] = generateTunnel(false, true, false);
                metrics["numRooms"] += 1;
                metrics["numDangers"] += 1;
            } else if (coinFlip(hiddenDangerP)) {
                subTree[i] = generateSubTree(cur_endP * scaling_endP, depth + 1);
                subTree[i]["hiddenDanger"] = true;
                metrics["numRooms"] += 1;
                metrics["numHiddenDangers"] += 1;
            } else {
                subTree[i] = generateSubTree(cur_endP * scaling_endP, depth + 1);
            }
        }
        /* Check if the immediate tunnel is a hidden danger, and make
        this a human warning node if such */
        for (let i = 0; i < 3; i++) {
            if (subTree[i] !== -1 && (subTree[i]["danger"] || subTree[i]["hiddenDanger"])) {
                subTree["humanWarning"] = `Traveler: I heard something dangerous near the ${generateHumanText(i)}`
            }
        }
        return subTree;
    }

    let finalTree = generateSubTree(starting_endP, 0);
    while (finalTree["end"] || finalTree["danger"] || finalTree["hiddenDanger"]) {
        finalTree = generateSubTree(starting_endP, 0);
    }
    return finalTree;
}

function updateAIMapText() {
    var AI_info_text = document.getElementById("ai_info");
    AI_info_text.textContent = `The Dungeon Map indicates ${aiMap} is the best route!`;
}

function generateAIMap(subtree) {
    let queue = new Deque([[subtree, ""]]);
    let dirArr = ["L", "M", "R"];

    while (!queue.isEmpty()) {
        let room = queue.removeFront();
        if (room[0]["end"] === undefined || room[0]["danger"]) {
            continue;
        }
        if (room[0]["end"]) {
            return room[1];
        } 
        for (let i = 0; i < 3; i++) {
            queue.insertBack([room[0][i], room[1] + dirArr[i]]);
        }
    }
    return "";
}

function getCurrentSubtree() {
    dirArr = {"L":0, "M":1, "R":2}
    function getCurrentSubtreeHelper(cur_subtree, i) {
        if (i == playerSteps.length) {
            return cur_subtree;
        }
        return getCurrentSubtreeHelper(cur_subtree[dirArr[playerSteps[i]]], i + 1);
    }

    return getCurrentSubtreeHelper(dungeon_tree, 0);
}

function movePlayer(dir) {
    var current_steps_text = document.getElementById("current_level");
    var human_info_text = document.getElementById("human_info");
    playerSteps += dir;
    let curSubTree = getCurrentSubtree();
    aiMap = generateAIMap(curSubTree);
    updateAIMapText();

    current_steps_text.textContent = `Current Steps: ${playerSteps}`;
    human_info_text.textContent = curSubTree["humanWarning"];
    if (curSubTree["danger"] || curSubTree["hiddenDanger"]) {
        metrics["diedByHiddenDanger"] = curSubTree["hiddenDanger"]
        var death_screen_text = document.getElementById("death_screen");
        death_screen_text.style.display = "block";
    } else if (curSubTree["end"]) {
        var win_screen_text = document.getElementById("win_screen");
        success = true
        win_screen_text.style.display = "block";
    }
}

function movePlayerLeft() {
    movePlayer("L");
}

function movePlayerMiddle() {
    movePlayer("M");
}

function movePlayerRight() {
    movePlayer("R");
}



function endGame() {
    function findPFP() {
        let matches = 0;
        for (let i = 0; i < Math.max(aiMap.length, playerSteps.length); i++) {
            if (aiMap[i] == playerSteps[i]) {
                matches++;
            }
        }
        return matches / aiMap.length;
    }

    metrics["shortestPathLength"] = aiMap.length;
    metrics["playerFollowPercentage"] = findPFP()
    metrics["success"] = success;

    var startButton = document.getElementById("start_game");
    var gameSection = document.getElementById("game");
    var death_screen_text = document.getElementById("death_screen");
    var win_screen_text = document.getElementById("win_screen");

    aiMap = "";
    death_screen_text.style.display = "none";
    win_screen_text.style.display = "none";

    startButton.style.display = "block";
    gameSection.style.display = "none";

    if (DEBUG) {
        console.log(metrics);
    }
}

var start_game_button = document.getElementById("start_game");
var end_game_button = document.getElementById("end_game");
var left_button = document.getElementById("left_dir");
var middle_button = document.getElementById("middle_dir");
var right_button = document.getElementById("right_dir");

start_game_button.addEventListener("click", startGame);
end_game_button.addEventListener("click", endGame);
left_button.addEventListener("click", movePlayerLeft);
middle_button.addEventListener("click", movePlayerMiddle);
right_button.addEventListener("click", movePlayerRight);
