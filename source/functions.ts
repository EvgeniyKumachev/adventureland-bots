import { ItemInfo, MonsterType, ItemName, IPosition, MapName, Entity, PositionReal, SkillName, BankPackType, CharacterType } from "./definitions/adventureland"
import { MyItemInfo, EmptyBankSlots, MonsterSpawnPosition } from "./definitions/bots"

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isNPC(entity: Entity): boolean {
    return entity.npc ? true : false
}

export function isMonster(entity: Entity): boolean {
    return entity.type == "monster"
}

export function isPlayer(entity: Entity): boolean {
    return entity.type == "character" && !isNPC(entity)
}

export async function startKonami(): Promise<MonsterType> {
    const result = new Promise<MonsterType>((resolve) => {
        parent.socket.once("game_response", (response: { response: string; monster: MonsterType }) => {
            resolve(response.monster)
        })
        parent.socket.emit("move", { "key": "up" })
        parent.socket.emit("move", { "key": "up" })
        parent.socket.emit("move", { "key": "down" })
        parent.socket.emit("move", { "key": "down" })
        parent.socket.emit("move", { "key": "left" })
        parent.socket.emit("move", { "key": "right" })
        parent.socket.emit("move", { "key": "left" })
        parent.socket.emit("move", { "key": "right" })
        parent.socket.emit("interaction", { "key": "B" })
        parent.socket.emit("interaction", { "key": "A" })
        parent.socket.emit("interaction", { "key": "enter" })
    })

    const timeout: Promise<MonsterType> = new Promise(function (resolve, reject) {
        setTimeout(reject, 5000)
    })

    return Promise.race([result, timeout])
}

/** Returns the inventory for the player, with all empty slots removed. */
export function getInventory(inventory = parent.character.items): MyItemInfo[] {
    const items: MyItemInfo[] = []
    for (let i = 0; i < 42; i++) {
        if (!inventory[i]) continue // No item in this slot
        items.push({ ...inventory[i], index: i })
    }
    return items
}

export function findItem(name: ItemName): MyItemInfo {
    for (let i = 0; i < 42; i++) {
        if (!parent.character.items[i]) continue // No item in this slot
        if (parent.character.items[i].name != name) continue // Item doesn't match.

        return { ...parent.character.items[i], index: i }
    }
}

export function findItems(name: ItemName): MyItemInfo[] {
    const items: MyItemInfo[] = []
    for (let i = 0; i < 42; i++) {
        if (!parent.character.items[i]) continue // No item in this slot
        if (parent.character.items[i].name != name) continue // Item doesn't match.

        items.push({ ...parent.character.items[i], index: i })
    }
    return items
}

export function findItemsWithLevel(name: ItemName, level: number): MyItemInfo[] {
    const items: MyItemInfo[] = []
    for (let i = 0; i < 42; i++) {
        if (!parent.character.items[i]) continue // No item in this slot
        if (parent.character.items[i].name != name) continue // Item doesn't match.
        if (parent.character.items[i].level != level) continue // Level doesn't match

        items.push({ ...parent.character.items[i], index: i })
    }
    return items
}

export function calculateDamageRange(attacker: Entity, defender: Entity): [number, number] {
    let baseDamage: number = attacker.attack
    // TODO: Are these guaranteed to be on IEntity? If they are we don't need to check and set them to zero.
    if (!attacker.apiercing) attacker.apiercing = 0
    if (!attacker.rpiercing) attacker.rpiercing = 0
    if (!defender.armor) defender.armor = 0
    // eslint-disable-next-line @typescript-eslint/camelcase
    if (!attacker.damage_type && attacker.slots.mainhand) attacker.damage_type = G.items[attacker.slots.mainhand.name].damage

    if (defender["1hp"]) {
        return [1, 1]
    }

    if (attacker.damage_type == "physical") {
        // Armor
        baseDamage *= damage_multiplier(defender.armor - attacker.apiercing)
    } else if (attacker.damage_type == "magical") {
        // Resistance
        baseDamage *= damage_multiplier(defender.resistance - attacker.rpiercing)
    }

    return [baseDamage * 0.9, baseDamage * 1.1]
}

/** Returns true if we're walking towards an entity. Used for checking if we can attack higher level enemies while we're moving somewhere */
// TODO: Finish this function, it's currently broken, don't use it.
export function areWalkingTowards(entity: Entity): boolean {
    if (!parent.character.moving) return false
    if (parent.character.vx < 0 && parent.character.real_x - entity.real_x > 0) return true
}

/** Also works for NPCs! */
export function canSeePlayer(name: string): boolean {
    return parent.entities[name] ? true : false
}

/** Returns the amount of ms we have to wait to use this skill */
export function getCooldownMS(skill: SkillName): number {
    if (parent.next_skill && parent.next_skill[skill]) {
        const ms = parent.next_skill[skill].getTime() - Date.now()
        return ms < parent.character.ping ? parent.character.ping : ms
    } else {
        return parent.character.ping
    }
}

/** Returns the expected amount of time to kill a given monster */
export function estimatedTimeToKill(attacker: Entity, defender: Entity): number {
    const damage = calculateDamageRange(attacker, defender)[0]
    let evasionMultiplier = 1
    if (defender.evasion && attacker.damage_type == "physical") {
        evasionMultiplier -= defender.evasion * 0.01
    }
    const attacksPerSecond = attacker.frequency
    const numberOfAttacks = Math.ceil(evasionMultiplier * defender.hp / damage)

    return numberOfAttacks / attacksPerSecond
}

export function getExchangableItems(inventory?: ItemInfo[]): MyItemInfo[] {
    const items: MyItemInfo[] = []

    for (const item of getInventory(inventory)) {
        if (G.items[item.name].e) items.push(item)
    }

    return items
}

export function isInventoryFull(store: ItemInfo[] = parent.character.items): boolean {
    for (let i = 0; i < store.length; i++) {
        if (!store[i]) return false
    }
    return true
}

export function getPartyMemberTypes(): Set<CharacterType> {
    const types = new Set<CharacterType>()
    for (const name of parent.party_list) {
        types.add(parent.party[name].type)
    }
    return types
}

export function getEmptySlots(store: ItemInfo[] = parent.character.items): number[] {
    const slots: number[] = []
    for (let i = 0; i < store.length; i++) {
        if (!store[i]) slots.push(i)
    }
    return slots
}

export function getEmptyBankSlots(): EmptyBankSlots[] {
    if (parent.character.map != "bank") return // We can only find out what bank slots we have if we're on the bank map.

    const emptySlots: EmptyBankSlots[] = []

    for (const store in parent.character.bank) {
        if (store == "gold") continue
        for (let i = 0; i < 42; i++) {
            const item = parent.character.bank[store as BankPackType][i]
            if (!item) emptySlots.push({ pack: store as Exclude<BankPackType, "gold">, "index": i })
        }
    }

    return emptySlots
}

export function isAvailable(skill: SkillName): boolean {
    // Check if we have the required level to use this skill
    const skillLevel = G.skills[skill].level
    if (skillLevel && skillLevel > parent.character.level) return false

    // Check if we have a status effect preventing us from using this skill
    if (parent.character.stoned) return false
    if (parent.character.rip) return false

    // Check if we have the required weapon to use this skill
    const skillWeaponType = G.skills[skill].wtype
    if (skillWeaponType && skillWeaponType != G.items[parent.character.slots.mainhand.name].wtype) return false

    // Check if we have the required items to use this skill
    if (G.skills[skill].slot) {
        for (const requiredItem of G.skills[skill].slot) {
            if (parent.character.slots[requiredItem[0]].name != requiredItem[1]) return false
        }
    }

    // Check if we have the required class to use this skill
    if (G.skills[skill].class) {
        let skillClass = false
        for (const classType of G.skills[skill].class) {
            if (classType == parent.character.ctype) {
                skillClass = true
                break
            }
        }
        if (!skillClass) return false
    }

    // Check we have enough MP to use this skill
    let mp = 0
    if (G.skills[skill].mp) {
        mp = G.skills[skill].mp
    } else if (["attack", "heal"].includes(skill)) {
        mp = parent.character.mp_cost
    }
    if (parent.character.mp < mp) return false

    // Check if the skill is on cooldown
    // if (!parent.next_skill) return false // TODO: I don't think that this is possible?
    if (parent.next_skill[skill] === undefined) return true
    const skillShare = G.skills[skill].share
    if (skillShare) return parent.next_skill[skillShare] ? (Date.now() >= parent.next_skill[skillShare].getTime()) : true
    return Date.now() >= parent.next_skill[skill].getTime()
}

/** Returns the entities we are being attacked by */
export function getAttackingEntities(): Entity[] {
    const entitites: Entity[] = []
    const isPVP = is_pvp()
    for (const id in parent.entities) {
        const entity = parent.entities[id]
        if (entity.target != parent.character.id) continue // Not being targeted by this entity
        if (isPlayer(entity) && !isPVP) continue // Not PVP, ignore players

        entitites.push(entity)
    }
    return entitites
}

export function getVisibleMonsterTypes(): Set<MonsterType> {
    const monsterTypes = new Set<MonsterType>()
    for (const id in parent.entities) {
        const entity = parent.entities[id]
        if (entity.mtype) monsterTypes.add(entity.mtype)
    }
    return monsterTypes
}

/** Returns monsters in attack range */
export function getInRangeMonsters(): Entity[] {
    const entities: Entity[] = []
    for (const id in parent.entities) {
        const e = parent.entities[id]
        if (!isMonster(e)) continue
        if (distance(e, parent.character) > parent.character.range) continue

        entities.push(e)
    }
    return entities
}

export function sendMassCM(names: string[], data: any): void {
    for (const name of names) {
        send_local_cm(name, data)
    }
}

export function getMonsterSpawns(type: MonsterType): PositionReal[] {
    const spawnLocations: PositionReal[] = []
    for (const id in G.maps) {
        const map = G.maps[id as MapName]
        if (map.instance) continue
        for (const monster of map.monsters || []) {
            if (monster.type != type) continue
            if (monster.boundary) {
                spawnLocations.push({ "map": id as MapName, "x": (monster.boundary[0] + monster.boundary[2]) / 2, "y": (monster.boundary[1] + monster.boundary[3]) / 2 })
            } else if (monster.boundaries) {
                for (const boundary of monster.boundaries) {
                    spawnLocations.push({ "map": boundary[0], "x": (boundary[1] + boundary[3]) / 2, "y": (boundary[2] + boundary[4]) / 2 })
                }
            }
        }
    }

    return spawnLocations
}

export function getRandomMonsterSpawn(type: MonsterType): PositionReal {
    const monsterSpawns = getMonsterSpawns(type)
    return monsterSpawns[Math.floor(Math.random() * monsterSpawns.length)]
}

export function getClosestMonsterSpawn(type: MonsterType): PositionReal {
    const monsterSpawns = getMonsterSpawns(type)
    let closestSpawnDistance = Number.MAX_VALUE
    let closestSpawn
    for (const spawn of monsterSpawns) {
        const d = parent.distance(parent.character, spawn)
        if (d < closestSpawnDistance) {
            closestSpawnDistance = d
            closestSpawn = spawn
        }
    }

    return closestSpawn
}

// TODO: Change this to a custom typed object instead of an array
export function getNearbyMonsterSpawns(position: IPosition, radius = 1000): MonsterSpawnPosition[] {
    const locations: MonsterSpawnPosition[] = []
    const map = G.maps[position.map]
    if (map.instance) return
    for (const monster of map.monsters || []) {
        if (monster.boundary) {
            const location = { "map": position.map as MapName, "x": (monster.boundary[0] + monster.boundary[2]) / 2, "y": (monster.boundary[1] + monster.boundary[3]) / 2 }
            if (distance(position, location) < radius) locations.push({ ...location, monster: monster.type })
            else if (position.x >= monster.boundary[0] && position.x <= monster.boundary[2] && position.y >= monster.boundary[1] && position.y <= monster.boundary[3]) locations.push({ ...location, monster: monster.type })
        } else if (monster.boundaries) {
            for (const boundary of monster.boundaries) {
                if (boundary[0] != position.map) continue
                const location = { "map": position.map, "x": (boundary[1] + boundary[3]) / 2, "y": (boundary[2] + boundary[4]) / 2 }
                if (distance(position, location) < radius) locations.push({ ...location, monster: monster.type })
                else if (position.x >= boundary[1] && position.x <= boundary[3] && position.y >= boundary[2] && position.y <= boundary[4]) locations.push({ ...location, monster: monster.type })
            }
        }
    }

    // Sort them so the closest one is first.
    locations.sort((a, b) => {
        return distance(position, a) > distance(position, b) ? 1 : -1
    })

    return locations
}

export async function buyIfNone(itemName: ItemName, targetLevel = 9, targetQuantity = 1): Promise<void> {
    let foundNPCBuyer = false
    if (!G.maps[parent.character.map].npcs) return
    for (const npc of G.maps[parent.character.map].npcs) {
        if (G.npcs[npc.id].role != "merchant") continue
        if (distance(parent.character, {
            x: npc.position[0],
            y: npc.position[1]
        }) < 350) {
            foundNPCBuyer = true
            break
        }
    }
    if (!foundNPCBuyer) return // Can't buy things, nobody is near.

    let items = findItemsWithLevel(itemName, targetLevel)
    if (items.length >= targetQuantity) return // We have enough

    items = findItems(itemName)
    if (items.length < Math.min(2, targetQuantity)) await buy_with_gold(itemName, 1) // Buy more if we don't have any to upgrade
}