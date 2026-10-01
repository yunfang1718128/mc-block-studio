// Curated catalogue of full-cube blocks usable for pixel art.
//
// `side` (and the other face fields) are file basenames (without `.png`) inside
// Mojang's bedrock-samples `resource_pack/textures/blocks/` directory. `java`
// is the Java Edition block id used in exported litematic files.
//
// Only fully opaque, full-cube blocks belong here. `side` is the default
// texture for every face; `top` / `bottom` / `front` (an alias for the south
// face) override individual faces when the block has distinct ones. For blocks
// whose four sides differ, set `north` / `south` / `east` / `west` explicitly.
//
// `kind: "functional"` blocks (chests, furnaces, ...) are offered as replica
// sources only — they are kept out of the colour-matching palette.

export const FACE_DIRS = ["north", "south", "east", "west", "top", "bottom"];

const COLORS = [
  { id: "white", zh: "白", tex: "white" },
  { id: "orange", zh: "橙", tex: "orange" },
  { id: "magenta", zh: "品红", tex: "magenta" },
  { id: "light_blue", zh: "淡蓝", tex: "light_blue" },
  { id: "yellow", zh: "黄", tex: "yellow" },
  { id: "lime", zh: "黄绿", tex: "lime" },
  { id: "pink", zh: "粉", tex: "pink" },
  { id: "gray", zh: "灰", tex: "gray" },
  { id: "light_gray", zh: "淡灰", tex: "silver" },
  { id: "cyan", zh: "青", tex: "cyan" },
  { id: "purple", zh: "紫", tex: "purple" },
  { id: "blue", zh: "蓝", tex: "blue" },
  { id: "brown", zh: "棕", tex: "brown" },
  { id: "green", zh: "绿", tex: "green" },
  { id: "red", zh: "红", tex: "red" },
  { id: "black", zh: "黑", tex: "black" },
];

/**
 * @typedef {{
 *   java: string,
 *   name: string,
 *   category: string,
 *   kind?: "solid" | "functional",
 *   side: string,
 *   top?: string,
 *   bottom?: string,
 *   front?: string,
 *   north?: string,
 *   south?: string,
 *   east?: string,
 *   west?: string
 * }} Entry
 */

/** @type {Entry[]} */
const blocks = [];

for (const c of COLORS) {
  blocks.push({
    java: `${c.id}_wool`,
    name: `${c.zh}色羊毛`,
    category: "羊毛",
    side: `wool_colored_${c.tex}`,
  });
  blocks.push({
    java: `${c.id}_concrete`,
    name: `${c.zh}色混凝土`,
    category: "混凝土",
    side: `concrete_${c.tex}`,
  });
  blocks.push({
    java: `${c.id}_terracotta`,
    name: `${c.zh}色陶瓦`,
    category: "陶瓦",
    side: `hardened_clay_stained_${c.tex}`,
  });
}

blocks.push({
  java: "terracotta",
  name: "陶瓦",
  category: "陶瓦",
  side: "hardened_clay",
});

/** @param {[string, string, string, string?, string?][]} rows */
function push(category, rows) {
  for (const [java, name, side, top, bottom] of rows) {
    blocks.push({ java, name, category, side, top, bottom });
  }
}

push("木板", [
  ["oak_planks", "橡木木板", "planks_oak"],
  ["spruce_planks", "云杉木板", "planks_spruce"],
  ["birch_planks", "白桦木板", "planks_birch"],
  ["jungle_planks", "丛林木板", "planks_jungle"],
  ["acacia_planks", "金合欢木板", "planks_acacia"],
  ["dark_oak_planks", "深色橡木木板", "planks_big_oak"],
  ["bamboo_planks", "竹板", "bamboo_planks"],
  ["cherry_planks", "樱花木板", "cherry_planks"],
  ["mangrove_planks", "红树木板", "mangrove_planks"],
  ["pale_oak_planks", "苍白橡木木板", "pale_oak_planks"],
]);

push("原木", [
  ["oak_log", "橡木原木", "log_oak", "log_oak_top"],
  ["spruce_log", "云杉原木", "log_spruce", "log_spruce_top"],
  ["birch_log", "白桦原木", "log_birch", "log_birch_top"],
  ["jungle_log", "丛林原木", "log_jungle", "log_jungle_top"],
  ["acacia_log", "金合欢原木", "log_acacia", "log_acacia_top"],
  ["dark_oak_log", "深色橡木原木", "log_big_oak", "log_big_oak_top"],
  ["cherry_log", "樱花原木", "cherry_log_side", "cherry_log_top"],
  ["mangrove_log", "红树原木", "mangrove_log_side", "mangrove_log_top"],
  ["pale_oak_log", "苍白橡木原木", "pale_oak_log_side", "pale_oak_log_top"],
  ["bamboo_block", "竹块", "bamboo_block", "bamboo_block_top"],
]);

push("石类", [
  ["stone", "石头", "stone"],
  ["granite", "花岗岩", "stone_granite"],
  ["polished_granite", "磨制花岗岩", "stone_granite_smooth"],
  ["diorite", "闪长岩", "stone_diorite"],
  ["polished_diorite", "磨制闪长岩", "stone_diorite_smooth"],
  ["andesite", "安山岩", "stone_andesite"],
  ["polished_andesite", "磨制安山岩", "stone_andesite_smooth"],
  ["cobblestone", "圆石", "cobblestone"],
  ["mossy_cobblestone", "苔石", "cobblestone_mossy"],
  ["tuff", "凝灰岩", "tuff"],
  ["polished_tuff", "磨制凝灰岩", "polished_tuff"],
  ["chiseled_tuff", "雕纹凝灰岩", "chiseled_tuff", "chiseled_tuff_top"],
  ["calcite", "方解石", "calcite"],
  ["dripstone_block", "滴水石块", "dripstone_block"],
]);

push("砖类", [
  ["stone_bricks", "石砖", "stonebrick"],
  ["mossy_stone_bricks", "苔石砖", "stonebrick_mossy"],
  ["cracked_stone_bricks", "裂纹石砖", "stonebrick_cracked"],
  ["chiseled_stone_bricks", "雕纹石砖", "stonebrick_carved"],
  ["bricks", "砖块", "brick"],
  ["tuff_bricks", "凝灰岩砖", "tuff_bricks"],
  ["mud_bricks", "泥砖", "mud_bricks"],
  ["packed_mud", "泥坯", "packed_mud"],
  ["clay", "黏土", "clay"],
  ["mud", "泥巴", "mud"],
]);

push("砂岩", [
  ["sandstone", "砂岩", "sandstone_normal", "sandstone_top", "sandstone_bottom"],
  ["cut_sandstone", "切制砂岩", "sandstone_carved", "sandstone_top", "sandstone_top"],
  ["smooth_sandstone", "平滑砂岩", "sandstone_smooth", "sandstone_smooth", "sandstone_smooth"],
  ["red_sandstone", "红砂岩", "red_sandstone_normal", "red_sandstone_top", "red_sandstone_bottom"],
  ["cut_red_sandstone", "切制红砂岩", "red_sandstone_carved", "red_sandstone_top", "red_sandstone_top"],
  ["smooth_red_sandstone", "平滑红砂岩", "red_sandstone_smooth", "red_sandstone_smooth", "red_sandstone_smooth"],
]);

push("石英", [
  ["quartz_block", "石英块", "quartz_block_side", "quartz_block_top", "quartz_block_bottom"],
  ["smooth_quartz", "平滑石英块", "quartz_block_bottom", "quartz_block_bottom", "quartz_block_bottom"],
  ["chiseled_quartz_block", "雕纹石英块", "quartz_block_chiseled", "quartz_block_chiseled_top"],
  ["quartz_pillar", "石英柱", "quartz_block_lines", "quartz_block_lines_top"],
  ["quartz_bricks", "石英砖", "quartz_bricks"],
]);

push("下界", [
  ["netherrack", "下界岩", "netherrack"],
  ["nether_bricks", "下界砖块", "nether_brick"],
  ["red_nether_bricks", "红色下界砖块", "red_nether_brick"],
  ["chiseled_nether_bricks", "雕纹下界砖块", "chiseled_nether_bricks"],
  ["cracked_nether_bricks", "裂纹下界砖块", "cracked_nether_bricks"],
  ["nether_wart_block", "下界疣块", "nether_wart_block"],
  ["soul_sand", "灵魂沙", "soul_sand"],
  ["soul_soil", "灵魂土", "soul_soil"],
  ["blackstone", "黑石", "blackstone", "blackstone_top"],
  ["polished_blackstone", "磨制黑石", "polished_blackstone"],
  ["polished_blackstone_bricks", "磨制黑石砖", "polished_blackstone_bricks"],
  ["chiseled_polished_blackstone", "雕纹磨制黑石", "chiseled_polished_blackstone"],
  ["gilded_blackstone", "镶金黑石", "gilded_blackstone"],
  ["basalt", "玄武岩", "basalt_side", "basalt_top"],
  ["polished_basalt", "磨制玄武岩", "polished_basalt_side", "polished_basalt_top"],
  ["smooth_basalt", "平滑玄武岩", "smooth_basalt"],
  ["magma_block", "岩浆块", "magma"],
  ["shroomlight", "菌光体", "shroomlight"],
  ["crimson_nylium", "绯红菌岩", "crimson_nylium_side", "crimson_nylium_top"],
  ["warped_nylium", "诡异菌岩", "warped_nylium_side", "warped_nylium_top"],
  ["warped_wart_block", "诡异疣块", "warped_wart_block"],
  ["resin_block", "树脂块", "resin_block"],
]);

push("末地", [
  ["end_stone", "末地石", "end_stone"],
  ["end_stone_bricks", "末地石砖", "end_bricks"],
  ["purpur_block", "紫珀块", "purpur_block"],
  ["purpur_pillar", "紫珀柱", "purpur_pillar", "purpur_pillar_top"],
  ["obsidian", "黑曜石", "obsidian"],
  ["crying_obsidian", "哭泣的黑曜石", "crying_obsidian"],
]);

push("海洋", [
  ["prismarine", "海晶石", "prismarine_rough"],
  ["prismarine_bricks", "海晶石砖", "prismarine_bricks"],
  ["dark_prismarine", "暗海晶石", "prismarine_dark"],
]);

push("金属与矿物", [
  ["iron_block", "铁块", "iron_block"],
  ["raw_iron_block", "粗铁块", "raw_iron_block"],
  ["gold_block", "金块", "gold_block"],
  ["raw_gold_block", "粗金块", "raw_gold_block"],
  ["diamond_block", "钻石块", "diamond_block"],
  ["emerald_block", "绿宝石块", "emerald_block"],
  ["coal_block", "煤炭块", "coal_block"],
  ["lapis_block", "青金石块", "lapis_block"],
  ["redstone_block", "红石块", "redstone_block"],
  ["netherite_block", "下界合金块", "netherite_block"],
  ["amethyst_block", "紫水晶块", "amethyst_block"],
]);

push("铜", [
  ["copper_block", "铜块", "copper_block"],
  ["exposed_copper", "斑驳的铜块", "exposed_copper"],
  ["weathered_copper", "锈蚀的铜块", "weathered_copper"],
  ["oxidized_copper", "氧化的铜块", "oxidized_copper"],
  ["cut_copper", "切制铜块", "cut_copper"],
  ["exposed_cut_copper", "斑驳的切制铜块", "exposed_cut_copper"],
  ["weathered_cut_copper", "锈蚀的切制铜块", "weathered_cut_copper"],
  ["oxidized_cut_copper", "氧化的切制铜块", "oxidized_cut_copper"],
  ["raw_copper_block", "粗铜块", "raw_copper_block"],
]);

push("有机方块", [
  ["hay_block", "干草捆", "hay_block_side", "hay_block_top"],
  ["bookshelf", "书架", "bookshelf"],
  ["sponge", "海绵", "sponge"],
  ["honeycomb_block", "蜜脾块", "honeycomb"],
  ["bone_block", "骨块", "bone_block_side", "bone_block_top"],
  ["melon", "西瓜", "melon_side", "melon_top"],
  ["pumpkin", "南瓜", "pumpkin_side", "pumpkin_top"],
  ["moss_block", "苔藓块", "moss_block"],
  ["sculk", "幽匿块", "sculk"],
]);

push("泥土与沙", [
  // bedrock-samples stores the tint-masked overlay as `grass_side.tga` /
  // `grass_top.png`; the `_carried` variants hold the pre-tinted colours, which
  // is what we want for a fixed palette.
  ["grass_block", "草方块", "grass_side_carried", "grass_carried", "dirt"],
  ["dirt", "泥土", "dirt"],
  ["coarse_dirt", "砂土", "coarse_dirt"],
  ["rooted_dirt", "缠根泥土", "dirt_with_roots"],
  ["podzol", "灰化土", "dirt_podzol_side", "dirt_podzol_top"],
  ["mycelium", "菌丝体", "mycelium_side", "mycelium_top"],
  ["sand", "沙子", "sand"],
  ["red_sand", "红沙", "red_sand"],
  ["gravel", "沙砾", "gravel"],
]);

push("冰雪", [
  ["snow_block", "雪块", "snow"],
  ["packed_ice", "浮冰", "ice_packed"],
  ["blue_ice", "蓝冰", "blue_ice"],
]);

/**
 * Decorative / functional full cubes. Kept out of the matching palette, but
 * offered as sources for the block-replica tab.
 *
 * @param {Omit<Entry, "kind">[]} entries
 */
function pushFunctional(entries) {
  for (const entry of entries) blocks.push({ kind: "functional", ...entry });
}

pushFunctional([
  // 容器
  { java: "chest", name: "箱子", category: "容器", side: "chest_side", top: "chest_top", bottom: "chest_top", front: "chest_front" },
  { java: "trapped_chest", name: "陷阱箱", category: "容器", side: "chest_side", top: "chest_top", bottom: "chest_top", front: "trapped_chest_front" },
  { java: "ender_chest", name: "末影箱", category: "容器", side: "ender_chest_side", top: "ender_chest_top", bottom: "ender_chest_top", front: "ender_chest_front" },
  { java: "barrel", name: "木桶", category: "容器", side: "barrel_side", top: "barrel_top", bottom: "barrel_bottom" },
  { java: "copper_chest", name: "铜箱子", category: "容器", side: "copper_chest_inventory_side", top: "copper_chest_inventory_top", bottom: "copper_chest_inventory_top", front: "copper_chest_inventory_front" },
  { java: "exposed_copper_chest", name: "斑驳的铜箱子", category: "容器", side: "exposed_copper_chest_inventory_side", top: "exposed_copper_chest_inventory_top", bottom: "exposed_copper_chest_inventory_top", front: "exposed_copper_chest_inventory_front" },
  { java: "weathered_copper_chest", name: "锈蚀的铜箱子", category: "容器", side: "weathered_copper_chest_inventory_side", top: "weathered_copper_chest_inventory_top", bottom: "weathered_copper_chest_inventory_top", front: "weathered_copper_chest_inventory_front" },
  { java: "oxidized_copper_chest", name: "氧化的铜箱子", category: "容器", side: "oxidized_copper_chest_inventory_side", top: "oxidized_copper_chest_inventory_top", bottom: "oxidized_copper_chest_inventory_top", front: "oxidized_copper_chest_inventory_front" },

  // 工作站
  { java: "crafting_table", name: "工作台", category: "工作站", side: "crafting_table_side", top: "crafting_table_top", bottom: "planks_oak", front: "crafting_table_front" },
  { java: "furnace", name: "熔炉", category: "工作站", side: "furnace_side", top: "furnace_top", bottom: "furnace_top", front: "furnace_front_off" },
  { java: "blast_furnace", name: "高炉", category: "工作站", side: "blast_furnace_side", top: "blast_furnace_top", bottom: "blast_furnace_top", front: "blast_furnace_front_off" },
  { java: "smoker", name: "烟熏炉", category: "工作站", side: "smoker_side", top: "smoker_top", bottom: "smoker_bottom", front: "smoker_front_off" },
  // 制图台有 side1/2/3 三种侧面，取代表值近似。
  { java: "cartography_table", name: "制图台", category: "工作站", side: "cartography_table_side1", top: "cartography_table_top", bottom: "planks_big_oak", east: "cartography_table_side2", west: "cartography_table_side3" },
  // 制箭台只有 side1/side2 两种侧面。
  { java: "fletcher_table", name: "制箭台", category: "工作站", side: "fletcher_table_side1", top: "fletcher_table_top", bottom: "planks_oak", north: "fletcher_table_side2" },
  { java: "smithing_table", name: "锻造台", category: "工作站", side: "smithing_table_side", top: "smithing_table_top", bottom: "smithing_table_bottom", front: "smithing_table_front" },
  { java: "loom", name: "织布机", category: "工作站", side: "loom_side", top: "loom_top", bottom: "loom_bottom", front: "loom_front" },
  { java: "lectern", name: "讲台", category: "工作站", side: "lectern_sides", top: "lectern_top", bottom: "lectern_base", front: "lectern_front" },
  // 切石机有一个"背面"贴图，其余三侧共用。
  { java: "stonecutter", name: "切石机", category: "工作站", side: "stonecutter_side", top: "stonecutter_top", bottom: "stonecutter_bottom", west: "stonecutter_other_side" },
  { java: "composter", name: "堆肥桶", category: "工作站", side: "composter_side", top: "composter_top", bottom: "composter_bottom" },
  // 合成器六面各不相同。
  { java: "crafter", name: "合成器", category: "工作站", side: "crafter_north", top: "crafter_top", bottom: "crafter_bottom", north: "crafter_north", south: "crafter_south", east: "crafter_east", west: "crafter_west" },

  // 蜂箱
  { java: "beehive", name: "蜂箱", category: "蜂箱", side: "beehive_side", top: "beehive_top", bottom: "beehive_top", front: "beehive_front" },
  { java: "bee_nest", name: "蜂巢", category: "蜂箱", side: "bee_nest_side", top: "bee_nest_top", bottom: "bee_nest_bottom", front: "bee_nest_front" },

  // 红石机械
  // 发射器/投掷器复用熔炉的侧面与顶面贴图。
  { java: "dispenser", name: "发射器", category: "红石机械", side: "furnace_side", top: "furnace_top", bottom: "furnace_top", front: "dispenser_front_horizontal" },
  { java: "dropper", name: "投掷器", category: "红石机械", side: "furnace_side", top: "furnace_top", bottom: "furnace_top", front: "dropper_front_horizontal" },
  { java: "observer", name: "侦测器", category: "红石机械", side: "observer_side", top: "observer_top", bottom: "observer_side", front: "observer_front", north: "observer_back" },
  { java: "piston", name: "活塞", category: "红石机械", side: "piston_side", top: "piston_top_normal", bottom: "piston_bottom" },
  { java: "sticky_piston", name: "黏性活塞", category: "红石机械", side: "piston_side", top: "piston_top_sticky", bottom: "piston_bottom" },
  { java: "note_block", name: "音符盒", category: "红石机械", side: "noteblock" },
  { java: "daylight_detector", name: "阳光探测器", category: "红石机械", side: "daylight_detector_side", top: "daylight_detector_top", bottom: "daylight_detector_top" },

  // 功能杂项
  { java: "jukebox", name: "唱片机", category: "功能杂项", side: "jukebox_side", top: "jukebox_top", bottom: "jukebox_side" },
  { java: "tnt", name: "TNT", category: "功能杂项", side: "tnt_side", top: "tnt_top", bottom: "tnt_bottom" },
  { java: "target", name: "标靶", category: "功能杂项", side: "target_side", top: "target_top", bottom: "target_top" },
  { java: "lodestone", name: "磁石", category: "功能杂项", side: "lodestone_side", top: "lodestone_top", bottom: "lodestone_top" },
  { java: "honey_block", name: "蜂蜜块", category: "功能杂项", side: "honey_side", top: "honey_top", bottom: "honey_bottom" },
  { java: "respawn_anchor", name: "重生锚", category: "功能杂项", side: "respawn_anchor_side0", top: "respawn_anchor_top", bottom: "respawn_anchor_bottom" },
  // 干海带块有两种不同的侧面。
  { java: "dried_kelp_block", name: "干海带块", category: "功能杂项", side: "dried_kelp_side_a", top: "dried_kelp_top", bottom: "dried_kelp_top", east: "dried_kelp_side_b" },
  { java: "chiseled_bookshelf", name: "雕纹书架", category: "功能杂项", side: "chiseled_bookshelf_side", top: "chiseled_bookshelf_top", bottom: "chiseled_bookshelf_side" },
  { java: "slime_block", name: "黏液块", category: "功能杂项", side: "slime" },
]);

/**
 * Resolve an entry's compact face fields into the six concrete texture names.
 * @param {Entry} entry
 * @returns {Record<string, string>}
 */
export function resolveFaces(entry) {
  const side = entry.side;
  return {
    north: entry.north ?? side,
    south: entry.south ?? entry.front ?? side,
    east: entry.east ?? side,
    west: entry.west ?? side,
    top: entry.top ?? side,
    bottom: entry.bottom ?? side,
  };
}

export const CATEGORIES = [...new Set(blocks.map((b) => b.category))];

export { blocks };

/** Every distinct texture basename referenced by the catalogue. */
export function allTextureNames() {
  const names = new Set();
  for (const b of blocks) {
    for (const name of Object.values(resolveFaces(b))) names.add(name);
  }
  return [...names].sort();
}
