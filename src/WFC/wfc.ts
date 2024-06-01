export type Rule = {
  weight: number;
  up: Array<number>;
  down: Array<number>;
  left: Array<number>;
  right: Array<number>;
};

//create custom event for completing a collapse of a tile
export const WFC_TILE_COLLAPSED = "wfc-tile-collapsed";
//create custom event for fully collapsing tilemap
export const WFC_COLLAPSE_COMPLETE = "wfc-collapse-complete";

export type SpriteSheetMap = Record<number, Rule>;

type TileData = {
  tileIndex: number;
  spriteIndex?: number;
  entropy?: number;
  availableTiles?: Array<number>;
};

export interface WfcConfig {
  name: string;
  tilemapDims: { width: number; height: number };
  seed?: number;
  rules?: SpriteSheetMap;
  auto?: boolean;
  spriteSheetDims: { width: number; height: number };
  startingIndex?: number;
  collapseDelay?: number;
}

enum WFC_BUFFER_STATES {
  collapsed = "collapsed",
  ready = "ready",
  collapsing = "collapsing",
  unknown = "unknown",
  default = "defaults",
}

type stepData = {
  collapsedIndex: number;
  state: TileData[];
};

export class WFC {
  name: string = "wfc";
  bufferstate: WFC_BUFFER_STATES = WFC_BUFFER_STATES.unknown;
  tilemapDims: { width: number; height: number };
  rules: SpriteSheetMap = {};
  steps: stepData[] = [];
  RNG: Random;
  tiles: TileData[] = [];
  auto: boolean = true;
  spritesheetdims: { width: number; height: number };
  generator: any;
  startingIndex: number = -1;
  yeildEvent: CustomEvent | undefined;
  completeEvent: CustomEvent | undefined;
  delay: number = 0;

  constructor(input: WfcConfig) {
    this.name = input.name;
    input.seed ? (this.RNG = new Random(input.seed)) : (this.RNG = new Random(Date.now()));
    this.tilemapDims = input.tilemapDims;
    input.rules ? (this.rules = input.rules) : (this.rules = []);
    input.collapseDelay ? (this.delay = input.collapseDelay) : (this.delay = 0);
    if (input.auto == true) this.auto = input.auto;
    else this.auto = false;
    this.spritesheetdims = input.spriteSheetDims;
    this.startingIndex = input.startingIndex ?? -1;
  }

  initialize() {
    if (Object.entries(this.rules).length == 0) throw new Error("No rules found");

    const numTiles = this.tilemapDims.width * this.tilemapDims.height;
    for (let i = 0; i < numTiles; i++) {
      this.tiles.push({
        tileIndex: i,
        spriteIndex: -1,
        entropy: Infinity,
        availableTiles: [],
      });
    }
    this.bufferstate = WFC_BUFFER_STATES.ready;
  }

  loadRules(rules: SpriteSheetMap) {
    this.rules = rules;
  }

  setWeight(spriteIndex: number, weight: number) {
    this.rules[spriteIndex].weight = weight;
  }

  reset() {
    this.rules = {};
    this.tiles = [];
    this.bufferstate = WFC_BUFFER_STATES.unknown;
  }

  setTile(index: number, spriteIndex: number) {
    this.tiles[index].spriteIndex = spriteIndex;
    this.tiles[index].availableTiles = [];
    this.tiles[index].entropy = 0;
    this._updateEntropy();
  }

  setDims(dims: { width: number; height: number }) {
    this.tilemapDims = dims;
  }

  getSpriteCoords(index: number): { x: number; y: number } {
    const spriteIndex = this.tiles[index].spriteIndex;
    if (spriteIndex == undefined || spriteIndex == -1) return { x: -1, y: -1 };
    let x = spriteIndex % this.spritesheetdims.width;
    let y = Math.floor(spriteIndex / this.spritesheetdims.width);
    return { x, y };
  }

  async generate() {
    if (this.bufferstate != WFC_BUFFER_STATES.ready) throw new Error("Buffer not ready to generate");

    let currentTile;
    if (this.startingIndex == -1) currentTile = this.RNG.getRandomInteger(0, this.tiles.length - 1);
    else currentTile = this.startingIndex;

    // select tile type and collapse tile entropy
    let firstTile = this.tiles[currentTile];
    // add to step data as a command pattern
    this.steps.push({ collapsedIndex: currentTile, state: structuredClone(this.tiles) });

    // collapse entropy
    let numSprites = Object.keys(this.rules).length;

    if (firstTile.entropy == Infinity) {
      const firstSpriteLookup = this.RNG.getRandomInteger(0, numSprites - 1);
      const firstSpriteKey = Object.keys(this.rules)[firstSpriteLookup];
      firstTile.spriteIndex = parseInt(firstSpriteKey);
    } else {
      let availableChoices = firstTile.availableTiles;
      const currentSelection = this.RNG.pickOneWeighted(availableChoices!, this.rules);
      firstTile.spriteIndex = currentSelection;
    }
    firstTile.entropy = 0;

    this._updateEntropy();

    // create generator
    this.generator = this._collapseNext();
    let done: Boolean | undefined = false;
    this.bufferstate = WFC_BUFFER_STATES.collapsing;
    if (this.auto)
      while (!done) {
        ({ done } = await this.generator.next());
        if (this.delay > 0) await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    else await this.generator.next();
    this.bufferstate = WFC_BUFFER_STATES.collapsed;
  }

  private async *_collapseNext() {
    while (true) {
      //find list of indexes with lowest entropy

      let lowestEntropyTiles = this._getListofTilesWithLowestEntropy();
      let randomTile = this.RNG.pickOne(lowestEntropyTiles);

      let availableChoices = randomTile.availableTiles;
      const currentSelection = this.RNG.pickOneWeighted(availableChoices!, this.rules);

      //collapsing tile and entropy
      randomTile.spriteIndex = currentSelection;
      randomTile.entropy = 0;

      //add to step data
      this.steps.push({ collapsedIndex: randomTile.tileIndex, state: structuredClone(this.tiles) });

      this._updateEntropy();
      //check for remainging tiles to collapse
      if (this._getNumberOfRemainingTilesToCollapse() == 0) {
        this.completeEvent = new CustomEvent(WFC_COLLAPSE_COMPLETE, { detail: { name: this.name, tiles: this.tiles } });
        window.dispatchEvent(this.completeEvent);
        return;
      }

      this.yeildEvent = new CustomEvent(WFC_TILE_COLLAPSED, { detail: { name: this.name, tile: randomTile } });
      window.dispatchEvent(this.yeildEvent);
      yield;
    }
  }

  async step() {
    if (this.generator) await this.generator.next();
  }

  private _getNumberOfRemainingTilesToCollapse(): number {
    return this.tiles.reduce((count, element) => {
      if (element.entropy != 0) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  private _getListofTilesWithLowestEntropy(): TileData[] {
    const filteredArrayNoZeroes = this.tiles.filter(t => t.entropy && t.entropy > 0);
    //@ts-ignore
    const minEntropy = Math.min(...filteredArrayNoZeroes.map(element => element.entropy));
    const lowestEntropyObjects = this.tiles.filter(element => element.entropy === minEntropy);
    return lowestEntropyObjects;
  }

  private _updateEntropy() {
    for (const tile of this.tiles) {
      const neighbors = this._getNeighbors(tile);

      for (const neighbor of Object.entries(neighbors)) {
        let [key, value] = neighbor;

        if (value == -1) continue;
        this.tiles[value].entropy = this._getEntropy(value);
      }
    }
  }

  private _getNeighbors(tile: TileData) {
    const index = this.tiles.indexOf(tile);
    const width = this.tilemapDims.width;
    //get neighbors and validate legitimacy
    let upTileIndex, rightTileIndex, leftTileIndex, downTileIndex;
    index - width < 0 ? (upTileIndex = -1) : (upTileIndex = index - width);
    index + width > this.tiles.length - 1 ? (downTileIndex = -1) : (downTileIndex = index + width);
    index % width == width - 1 ? (rightTileIndex = -1) : (rightTileIndex = index + 1);
    index % width == 0 ? (leftTileIndex = -1) : (leftTileIndex = index - 1);
    return {
      upTileIndex,
      rightTileIndex,
      leftTileIndex,
      downTileIndex,
    };
  }

  private _getEntropy(index: number): number {
    const width = this.tilemapDims.width;
    if (this.tiles[index].entropy == 0) return 0;

    //finding neighbors
    let upTileIndex, rightTileIndex, leftTileIndex, downTileIndex;
    index - width < 0 ? (upTileIndex = -1) : (upTileIndex = index - width);
    index + width > this.tiles.length - 1 ? (downTileIndex = -1) : (downTileIndex = index + width);
    index % width == width - 1 ? (rightTileIndex = -1) : (rightTileIndex = index + 1);
    index % width == 0 ? (leftTileIndex = -1) : (leftTileIndex = index - 1);

    //grab neighbor tiles allowed
    let upTileAvailableTiles: any[] = [];
    let downTileAvailableTiles: any[] = [];
    let leftTileAvailableTiles: any[] = [];
    let rightTileAvailableTiles: any[] = [];

    if (upTileIndex != -1 && this.tiles[upTileIndex].entropy == 0) {
      let uptiletype = this.tiles[upTileIndex].spriteIndex;

      if (uptiletype != undefined && this.tiles[upTileIndex].spriteIndex != -1) {
        upTileAvailableTiles = [...this.rules[uptiletype].down];
      }
    }
    if (downTileIndex != -1 && this.tiles[downTileIndex].entropy == 0) {
      let downTileType = this.tiles[downTileIndex].spriteIndex;
      if (downTileType != undefined && this.tiles[downTileIndex].spriteIndex != -1) {
        downTileAvailableTiles = [...this.rules[downTileType].up];
      }
    }
    if (leftTileIndex != -1 && this.tiles[leftTileIndex].entropy == 0) {
      let leftTileType = this.tiles[leftTileIndex].spriteIndex;
      if (leftTileType != undefined && this.tiles[leftTileIndex].spriteIndex != -1) {
        leftTileAvailableTiles = [...this.rules[leftTileType].right];
      }
    }
    if (rightTileIndex != -1 && this.tiles[rightTileIndex].entropy == 0) {
      let rightTileType = this.tiles[rightTileIndex].spriteIndex;
      if (rightTileType != undefined && this.tiles[rightTileIndex].spriteIndex != -1) {
        rightTileAvailableTiles = [...this.rules[rightTileType].left];
      }
    }

    //consolidate
    const testArray: any[] = [];
    if (upTileAvailableTiles.length) testArray.push(upTileAvailableTiles);
    if (downTileAvailableTiles.length) testArray.push(downTileAvailableTiles);
    if (leftTileAvailableTiles.length) testArray.push(leftTileAvailableTiles);
    if (rightTileAvailableTiles.length) testArray.push(rightTileAvailableTiles);

    // run debugger if not all the arrays are same
    if (testArray.length == 0) {
      return Infinity;
    }
    const consolodatedArray = testArray.reduce((sum, arr) => sum.filter((x: any) => arr.includes(x)), testArray[0]);

    if (consolodatedArray.length == 0) {
      //debugger;
      throw new Error("no available tiles");
    }
    this.tiles[index].availableTiles = [...consolodatedArray];
    if (this.tiles[index].availableTiles == undefined) throw new Error("no available tiles");
    //@ts-ignore
    return this.tiles[index].availableTiles.length;
  }

  private _undo() {
    //pop off last step
    const lastStep = this.steps.pop();
    if (lastStep == undefined) throw new Error("no steps to undo");
    this.tiles = lastStep.state;
    this.tiles[lastStep.collapsedIndex].spriteIndex = -1;
    this.tiles[lastStep.collapsedIndex].availableTiles = [];
    this.tiles[lastStep.collapsedIndex].entropy = Infinity;
    this._updateEntropy();
  }
}

class Random {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  getRandom(): number {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);
    this.seed = (a * this.seed + c) % m;
    return this.seed / m;
  }

  getRandomFloat(min: number, max: number): number {
    return this.getRandom() * max + min;
  }

  getRandomInteger(min: number, max: number): number {
    return Math.floor(this.getRandom() * max + min);
  }

  pickOne(set: Array<any>): any {
    let rnd = this.getRandom();
    let choice = Math.floor(rnd * set.length);
    return set[choice];
  }

  getSeed() {
    return this.seed;
  }

  pickOneWeighted(set: Array<any>, rules: SpriteSheetMap): any {
    let newSet: any[] = [];

    set.forEach(item => {
      const wieghting = rules[item].weight;
      for (let i = 0; i < wieghting; i++) {
        newSet.push(item);
      }
    });
    let rnd = this.getRandom();
    let choice = Math.floor(rnd * newSet.length);
    return newSet[choice];
  }
}
