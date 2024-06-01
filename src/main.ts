import "./style.css";
import { UI } from "@peasy-lib/peasy-ui";
import { Engine, DisplayMode, TileMap, ImageSource, SpriteSheet, Loader, Vector, Sprite } from "excalibur";
//@ts-ignore
import ffImage from "./assets/fftown.png";
import { SpriteSheetMap, WFC, WfcConfig } from "./WFC/wfc";
//@ts-ignore
import blanktile from "./assets/blanktile.png";
import { House } from "./house";
import { MapGen } from "./mapgen";
import { Road } from "./road";

const AUTO = true;

const model = {};
const template = `
<style> 
    canvas{ 
        position: fixed; 
        top:50%; 
        left:50%; 
        transform: translate(-50% , -50%); 
    }
</style> 
<div> 
    <canvas id='cnv'> </canvas> 
</div>`;
await UI.create(document.body, model, template).attached;
const blanksource = new ImageSource(blanktile);
const blankSprite = new Sprite({
  image: blanksource,
  sourceView: { x: 0, y: 0, width: 16, height: 16 },
});
const ffImageSource = new ImageSource(ffImage);
const ffSpriteSheet = SpriteSheet.fromImageSource({
  image: ffImageSource,
  grid: {
    rows: 3,
    columns: 11,
    spriteWidth: 16,
    spriteHeight: 16,
  },
});

const game = new Engine({
  width: 800, // the width of the canvas
  height: 600, // the height of the canvas
  canvasElementId: "cnv", // the DOM canvas element ID, if you are providing your own
  displayMode: DisplayMode.Fixed, // the display mode
  suppressPlayButton: true,
});

const loader = new Loader([ffImageSource, blanksource]);

// Create a tilemap
const tilemap = new TileMap({
  rows: 20,
  columns: 20,
  tileWidth: 16,
  tileHeight: 16,
});

const halfwidth = (tilemap.columns / 2) * tilemap.tileWidth;
const halfheight = (tilemap.rows / 2) * tilemap.tileHeight;

//create Map
const mapgen = new MapGen({
  treedensity: -5,
  mapWidth: 20,
  mapHeight: 20,
});

//create first house
let house1 = new House({
  name: "house1",
  maxWidth: 7,
  minWidth: 3,
  maxHeight: 6,
  minHeight: 3,
});
let startX = Math.floor(Math.random() * (tilemap.columns - house1.getDims().width)) + 1;
let startY = Math.floor(Math.random() * (tilemap.rows - house1.getDims().height));
house1.setStartingPosition({ x: startX, y: startY });

//create second house
let house2 = new House({
  name: "house2",
  maxWidth: 7,
  minWidth: 3,
  maxHeight: 6,
  minHeight: 3,
});
//find starting position given it doesn't collide with house1

let startX2 = Math.floor(Math.random() * (tilemap.columns - house2.getDims().width)) + 1;
let startY2 = Math.floor(Math.random() * (tilemap.rows - house2.getDims().height));
house2.setStartingPosition({ x: startX2, y: startY2 });
while (isHousesColliding(house1, house2)) {
  startX2 = Math.floor(Math.random() * (tilemap.columns - house2.getDims().width)) + 1;
  startY2 = Math.floor(Math.random() * (tilemap.rows - house2.getDims().height));
  house2.setStartingPosition({ x: startX2, y: startY2 });
}

await mapgen.generate();
await house1.generate();
await house2.generate();

await game.start(loader);
mapgen.draw(game, tilemap, ffSpriteSheet);
house1.draw(game, tilemap, ffSpriteSheet);
house2.draw(game, tilemap, ffSpriteSheet);

//add road
let { roadStart, roadEnd } = findRoadCoordinates();
if (roadStart.x == -1 && roadStart.y == -1 && roadEnd.x == -1 && roadEnd.y == -1) {
  game.add(tilemap);
} else {
  let road = new Road(tilemap, roadStart, roadEnd);
  road.draw(game, tilemap, ffSpriteSheet);
  game.add(tilemap);
}

game.currentScene.camera.pos = new Vector(halfwidth, halfheight);

game.currentScene.input.keyboard.on("press", async e => {
  if (e.key == "Space") {
    console.clear();
    mapgen.reset();
    house1.reset();
    house2.reset();
    let startX = Math.floor(Math.random() * (tilemap.columns - house1.getDims().width)) + 1;
    let startY = Math.floor(Math.random() * (tilemap.rows - house1.getDims().height));
    house1.setStartingPosition({ x: startX, y: startY });
    let startX2 = Math.floor(Math.random() * (tilemap.columns - house2.getDims().width)) + 1;
    let startY2 = Math.floor(Math.random() * (tilemap.rows - house2.getDims().height));
    house2.setStartingPosition({ x: startX2, y: startY2 });
    while (isHousesColliding(house1, house2)) {
      startX2 = Math.floor(Math.random() * (tilemap.columns - house2.getDims().width)) + 1;
      startY2 = Math.floor(Math.random() * (tilemap.rows - house2.getDims().height));
      house2.setStartingPosition({ x: startX2, y: startY2 });
    }
    await mapgen.generate();
    await house1.generate();
    await house2.generate();
    game.remove(game.currentScene.tileMaps[0]);
    mapgen.draw(game, tilemap, ffSpriteSheet);
    house1.draw(game, tilemap, ffSpriteSheet);
    house2.draw(game, tilemap, ffSpriteSheet);
    let { roadStart, roadEnd } = findRoadCoordinates();
    if (roadStart.x == -1 && roadStart.y == -1 && roadEnd.x == -1 && roadEnd.y == -1) {
      game.add(tilemap);
      return;
    }
    let road = new Road(tilemap, roadStart, roadEnd);
    road.draw(game, tilemap, ffSpriteSheet);
    game.add(tilemap);
  }
});

function isHousesColliding(house1: House, house2: House) {
  let testX1 = house1.getStartingPosition()!.x + house1.getDims().width > house2.getStartingPosition()!.x;
  let testX2 = house1.getStartingPosition()!.x < house2.getStartingPosition()!.x + house2.getDims().width;
  let testY1 = house1.getStartingPosition()!.y + house1.getDims().height > house2.getStartingPosition()!.y;
  let testY2 = house1.getStartingPosition()!.y < house2.getStartingPosition()!.y + house2.getDims().height;

  return testX1 && testX2 && testY1 && testY2;
}

function isRoadInHouse(house: House, startingCoords: { x: number; y: number }, endingCoords: { x: number; y: number }): boolean {
  //first check if the staringtile is in the house
  if (
    startingCoords.x >= house.getStartingPosition()!.x &&
    startingCoords.x < house.getStartingPosition()!.x + house.getDims().width &&
    startingCoords.y >= house.getStartingPosition()!.y &&
    startingCoords.y < house.getStartingPosition()!.y + house.getDims().height
  ) {
    return true;
  }

  //then check if the endingtile is in the house
  if (
    endingCoords.x >= house.getStartingPosition()!.x &&
    endingCoords.x < house.getStartingPosition()!.x + house.getDims().width &&
    endingCoords.y >= house.getStartingPosition()!.y &&
    endingCoords.y < house.getStartingPosition()!.y + house.getDims().height
  ) {
    return true;
  }

  return false;
}

function findRoadCoordinates() {
  //find first door
  let roadStart, roadEnd;

  let firstDoor = tilemap.tiles.find(t => t.data.get("tiletype") == "door");
  if (!firstDoor) roadStart = { x: -1, y: -1 };
  else roadStart = { x: firstDoor.x, y: firstDoor.y + 1 };

  let secondDoor = tilemap.tiles.findLast(t => t.data.get("tiletype") == "door");
  if (!secondDoor) roadEnd = { x: -1, y: -1 };
  else roadEnd = { x: secondDoor!.x, y: secondDoor!.y + 1 };

  //test two points
  //if points are outside of map, return -1,-1
  if (roadStart.x > 20 || roadStart.y > 20 || roadEnd.x > 20 || roadEnd.y > 20)
    return { roadStart: { x: -1, y: -1 }, roadEnd: { x: -1, y: -1 } };

  //test if start and end are colliding with house
  if (isRoadInHouse(house1, { x: roadStart.x, y: roadStart.y }, { x: roadEnd.x, y: roadEnd.y })) {
    roadStart = { x: -1, y: -1 };
    roadEnd = { x: -1, y: -1 };
  }

  return { roadStart, roadEnd };
}
