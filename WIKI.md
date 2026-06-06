# 🏭 APEX BLUEPRINT // GAMEPLAY WIKI

Welcome to the master manual and guidebook for **APEX BLUEPRINT**, a granular, text-based tabletop RPG simulation running your automotive workshop startup. This document outlines the core gameplay concepts, personnel dynamics, mechanics, and UI systems that guide your journey.

---

## 📂 TABLE OF CONTENTS
1. [Core Premise & Weekly Structure](#1-core-premise--weekly-structure)
2. [Campaign Setup & Setup Configurations](#2-campaign-setup--setup-configurations)
3. [The Crew & Character Stats](#3-the-crew--character-stats)
4. [Team Synergy & Friction Mechanics](#4-team-synergy--friction-mechanics)
5. [The Resolution Harness (PbtA Rules)](#5-the-resolution-harness-pbta-rules)
6. [The Team Rolodex (NPC Glossary)](#6-the-team-rolodex-npc-glossary)
7. [Data Slate Utilities & Chronicle Logs](#7-data-slate-utilities--chronicle-logs)
8. [Indie Cyberpunk Art Direction](#8-indie-cyberpunk-art-direction)
9. [Global Objectives & Campaign Milestones](#9-global-objectives--campaign-milestones)
10. [Extensible Facility State & Blueprint Prompt Engine](#10-extensible-facility-state--blueprint-prompt-engine)
11. [Workshop Monitor & Analytics Dashboard](#11-workshop-monitor--analytics-dashboard)
12. [Workshop Inventory Tracking System](#12-workshop-inventory-tracking-system)

---

## 1. Core Premise & Weekly Structure
You play as the lead **Architect** operating a startup automotive garage. Your goal is to design, engineer, and build high-performance prototype vehicles (such as electric track weapons or hybrid racers) while keeping the garage solvent.

* **Turn-Based Pacing**: Time progresses week by week. Each weekly turn presents you with workshop events, logistics struggles, and mechanical dilemmas.
* **The Turn Cycle**:
  1. The Game Master (AI) describes the weekly environment and presents active dilemmas.
  2. You describe your crew's response and assign characters to tasks. Characters left unassigned automatically enter a **Quiet Period**.
  3. The Game Master requests attribute rolls based on your description, determining the **Position** and **Effect** for active tasks.
  4. You roll the dice, transmit the result, select Quiet Period actions, and resolve the week.

### 💤 Quiet Periods & Downtime Protocols
Crew members who are not assigned to one of the week's active dilemmas do not sit idle. Instead, they enter a **Quiet Period** to execute safe, non-hazardous downtime protocols. The player selects one of three activities for each resting character:
1. **Passive Maintenance**: Safely removes the "Degraded" condition from a workshop node or generates a `+1` modifier for the next task attempted in that bay.
2. **Strategic Rest**: Restores `+20% Morale` and clears negative status conditions (such as *Burnt Out* or *Flipped Out*).
3. **Inventory Salvage**: Performs a safe check to increment raw material stockpiles (e.g., cylindrical battery cells) or fabricate minor tool assets.

---

## 2. Campaign Setup & Setup Configurations
When initiating a new campaign timeline, you define the core constraints and attributes of your business:

* **Powertrain Focus**: What powers your machines? (e.g., pure **EV** battery stacks, complex **Hybrid** setups, or high-revving **ICE** motors).
* **Market Segment**: Your target audience and product class (e.g., a lightweight **Track Weapon**, or a **Hypercar**).
* **Funding Core**: Your starting capital level (e.g., lean **Bootstrapped** budgets with lower starting cash but high autonomy, or capital-heavy **Venture Capital**).
* **Facility Flaws**: Pre-existing penalties that strain your workshop (e.g., a **Drafty Roof** that risks component moisture, or **Cramped Quarters** that limit simultaneous projects).
* **Architect Class**: Based on your starting attribute points, you receive a title showing your administrative focus:
  * **Engineer Architect**: Balanced setup.
  * **Project Director**: High Charisma focus.
  * **Operations Chief**: High Logistics focus.
  * **Product Strategist**: High Perception focus.

---

## 3. The Crew & Character Stats
Your workshop is staffed by three key crew members, each with specific attributes:
* **Lucius (The Architect)**: The player persona. Attributes depend on your character configuration.
* **Sarah (Energy Storage Specialist)**: Brilliant and technical, but keeps to herself. (High *Technical* & *Perception*, low *Charisma*).
* **Cousin Leo (Heavy Tooling Mechanic)**: Warm, experienced with metalwork, and highly organized. (High *Charisma* & *Logistics*, low *Perception*).

### Attribute Nodes
* **TECH (Technical)**: Used for drafting schematics, welding, electrical tuning, and repairing equipment.
* **CHA (Charisma)**: Used for vendor negotiations, investor pitches, client relations, and keeping crew morale high.
* **LOG (Logistics)**: Used for parts sourcing, shipping schedules, budget auditing, and workshop organization.
* **PER (Perception)**: Used for identifying manufacturing flaws, safety hazards, driver telemetry analysis, and testing prototypes.

### Morale & Efficiency
* Companions track a **Morale** metric (0% to 100%).
* A crew member's active morale acts as their **Efficiency rating**. When morale falls, they become prone to mistakes, adding complications to their assignments.

### 📈 Character Progression & Leveling
Characters improve their capabilities over time through active hands-on workshop experience:
* **Attribute Scores**: Range dynamically from `-3` to `+5` (representing extreme deficiency to legendary expertise).
* **Milestone Progression**: Each character tracks milestone points (from `0` to `3`) for each of the four attribute nodes (TECH, CHA, LOG, PER).
* **Earning Milestones**: When a character executes an assignment and rolls a **Strong Success (10+)**, they gain `1` Milestone Point in the attribute used.
* **Leveling Up**: Accumulating `3` Milestone Points in a given category permanently increases that attribute score by `+1` (resets the milestone tracker to `0`).
* **Progression Cap**: Attribute upgrades are capped at a baseline of `+4` workshop-wide. Attributes can reach `+5` through temporary modifiers or specialized inventory hardware.

### Mobility vs. Infrastructure
* **The Character Roster (`personnel`)**: This is for unique human assets with individual names, personal morale tracks, specialized class roles, and changing psychological traits (like Lucius, Sarah, Leo, and Jax). If an entity can burn out, argue with a teammate, or leave the garage entirely, they live in the personnel roster.
* **Facility Perks / Labor Nodes (`facility.infrastructure_nodes`)**: This is for collective labor pools, specialized team units, or automated tooling systems that function as static shop enhancements (like your Junior Line Techs, an external cleanroom team, or an automated robotic assembly arm). They do not have individual morale bars—they represent an upgrade to the workshop’s structural capability.

#### 🔁 When does a worker cross the line?
If the story dictates that a hired individual develops a unique interpersonal relationship with the core team, gains distinct personal stats, or gets promoted to a major engineering role (like Jax did in Week 13), the GM can dynamically "promote" them out of the facility array and push them into the personnel object with a dedicated role and morale tracking matrix.

---

## 4. Team Synergy & Friction Mechanics
The interpersonal relationships between your crew members directly impact the success of joint operations. The dashboard tracks the mutual synergy between all pairs of companion characters, excluding the Architect/player (e.g. `Sarah ✦ Cousin Leo`).

* **Synergy Metric Scale**: Ranges from `-3` (Active Hostility / Mutual Refusal to Cooperate) to `+3` (Seamless Cohesion / High Trust). The baseline is `0` (Professional Neutrality).
* **Joint Operations**: When you assign two characters to collaborate on a single task, their mutual synergy score is applied as a direct modifier to the action's success roll.
* **Interpersonal Consequences**:
  * A **Strong Success (10+)** on a joint task builds trust, increasing their synergy by `+1` (up to a maximum of `+3`).
  * A **Weak Success (7-9)** or **Operational Miss (6 or less)** frays their relationship, reducing their synergy by `-1` (down to a minimum of `-3`) as blame and communication strain set in.
* **Operational Strike**: If a pair's synergy hits `-3`, they refuse to collaborate on any combined tasks. You must dedicate a week to resolving their workplace grievance to unlock joint actions again.

---

## 5. The Resolution Harness (PbtA Rules)
APEX BLUEPRINT uses a Powered by the Apocalypse (PbtA) resolution system for risky actions:

* **The Check**: You roll **2d6** (two six-sided dice) and add the assigned character's attribute modifier, plus any synergy modifiers if it is a joint project.
* **Outcome Tiers**:
  * **[10+] Strong Success**: Complete victory. The task is completed cleanly with no structural downsides.
  * **[7-9] Weak Success**: Mixed outcome. The crew succeeds, but it introduces a complication, materials cost, or crew friction.
  * **[6 or Less] Operational Miss**: Failure. Things go critically wrong. Capital drops, morale breaks, components crack, or deadlines are missed.

### 📐 Position & Effect Matrix
Before any dice are rolled, the Game Master evaluates the context of the task and declares its **Position** (the risk/downside tier) and **Effect** (the reward/upside tier). Standard tasks default to *Risky* position and *Standard* effect.

* **Position (Risk Severity)**: Determines how severe the consequences are on a Weak Success (7-9) or Operational Miss (6 or less).
  * **Controlled**: Minor risk. Ticking `1` segment on a project clock on a partial success/failure.
  * **Risky**: Standard risk. Ticking `2` segments on a project clock, or applying standard financial/morale penalties.
  * **Desperate**: Severe risk. Ticking `3` segments on a project clock, or triggering immediate catastrophic penalties.
* **Effect (Success Magnitude)**: Determines the outcome scaling on a Strong Success (10+).
  * **Great**: Yields double progress (`+2` objective units) or clears `2` clock segments.
  * **Standard**: Yields standard progress (`+1` objective unit) or clears `1` clock segment.
  * **Limited**: Yields reduced progress (`+0.5` objective units).
* **Pre-Roll Optimization**: Before committing to a roll, players can optimize their odds:
  * **Expend Capital**: Spend `$5,000` to shift the task's Position one tier safer (e.g., from *Risky* to *Controlled*).
  * **Synergy Assist**: Add a second crew member to collaborate. This adds the partner's synergy modifier to the roll and improves the Effect tier by one, but both characters share the consequences of a poor roll.

### ⏱️ Segmented Project Clocks
To replace instantaneous "sudden explosions" with visible workshop tension, failures or partial successes tick down countdown clocks representing structural fatigue, thermal stress, or impending supply chain bottlenecks.

* **Clock Setting**: On a Weak Success (7-9) or Operational Miss (6 or Less), the Game Master may initiate a Segmented Project Clock (typically `4` or `6` segments, e.g., "Volatile Power Cell" or "Structural Fatigue") under the facility state.
* **Ticking the Clock**: Poor rolls tick the clock's segments based on the task's Position (*Controlled*: 1 segment, *Risky*: 2 segments, *Desperate*: 3 segments).
* **Catastrophe Trigger**: The physical/financial disaster (capital drain, permanent machine failure, or severe burnout) only fires if a clock's segments are completely filled.
* **Mitigation**: Players can assign crew members to dedicated **Repair or Mitigation** tasks during the turn cycle to clear segments of active clocks before they overflow.

---

## 6. The Team Rolodex (NPC Glossary)
As your startup grows, you will interact with external characters (investors, parts brokers, drivers, rivals). 

* **Faction Alignment**: The Rolodex displays each contact's faction standing (e.g., Ally, Hostile, Neutral).
* **Interactive Dossiers**: You can upload custom profile avatars for new characters. The dashboard includes a built-in zoom & pan crop tool to align uploaded images to graphic novel specifications.
* **Narrative Continuity**: NPC data is passed dynamically to the AI engine so that the narrative reflects their relationship status with your garage.

---

## 7. Data Slate Utilities & Chronicle Logs
To ensure continuity across play sessions, the dashboard uses localized data structures:

* **The Chronicle**: A week-by-week timeline of your workshop's history.
* **Smart Diff-Merging**: When you sync weekly updates, the system performs a smart merge:
  * Automatically filters out and skips range groupings (e.g., `W1-W11: Prior startup history tracked.`).
  * Skips logs for weeks that are already recorded in your history.
  * Appends new weekly logs to the bottom of the timeline.
* **Overwrite Option**: A checkbox utility allows you to bypass the merge and completely replace your history if you need to restore or restart a campaign timeline.
* **Data Slate Files**: You can export your entire campaign progress as a local `.json` save file or import one to resume play.

---

## 8. Indie Cyberpunk Art Direction
The visual identity of your dashboard and scenario updates reflects an **Indie Cyberpunk Graphic Novel aesthetic**:

* **Line Work**: Heavy, raw, ink-black lines with dramatic cross-hatching shadows and retro grid patterns.
* **Color Palette**: Vintage blueprint navy (`#1a365d`) and industrial mechanical amber (`#f6ad55`).
* **UI Themes**: Thick borders, flat boxes, and custom indicator status bars.

---

## 9. Global Objectives & Campaign Milestones
To support dynamic narratives and high-stakes campaigns, the Game Master (LLM) can introduce **Global Objectives**:
* **Shared Data Structure**: Each objective tracks critical parameters like `id`, `title`, `target_metric`, `current` progress, `target` goal, `status` (active/completed), and `bottleneck` descriptions detailing current project blockers.
* **Continuous Tracking**: Global Objectives are fully integrated into the ledger sync, auto-saving, and manual backup/restore mechanisms.

---

## 10. Extensible Facility State & Blueprint Prompt Engine
Instead of relying on hardcoded properties, the game state uses an **Extensible Entity-Attribute List architecture**:
* **Dynamic Workshop Assets**: Equipment, structural drawbacks, and workshop bays are tracked inside flexible arrays.
* **Standardized Rule Modifiers**: Every bay, tool, or flaw can contain a `rule_modifier` block detailing its target attribute, penalty/bonus value, and specific dice roll trigger conditions (e.g. `TECH -1 on "Electronics tasks during rain"`).
* **Blueprint Generation Engine**: The **Config & Assets** tab features a live prompt compiler that ingests the current facility state and outputs a high-detail graphic novel concept art prompt, ready to copy-paste into local image generators.

---

## 11. Workshop Monitor & Analytics Dashboard
The workshop monitor interface has been designed for maximum utility and visual clarity:
* **Workshop Blueprint Carousel**: Shows the historical evolution of your workshop layout. Defaults to the current week's blueprint render. Supports full zoom/pan lightboxing.
* **Split Analytics Views**: Capital and weekly expenses are separated into two distinct visualizations to prevent scaling compression issues:
  * **💵 Capital Trend**: Displays liquid asset levels over time.
  * **🔥 Burn Trend**: Tracks operations costs as a dashed-red trendline.
* **Local Folder Integration**: The workspace automatically scans the connected local directory for corresponding file naming rules (e.g., `facility/facility_week_{week}.png`) and binds them reactively.

---

## 12. Workshop Inventory Tracking System
To manage garage logistics and production pipelines, the runtime core tracks the workshop's stock assets and feedstock materials:
* **Vehicles & Chassis Inventory**: Details track-ready prototype vehicles or base chassis stored in the workshop bays.
  * Attributes tracked include: `id`, a descriptive `label`, current stock `status` (e.g., Safe Stock), physical `condition` (Optimal, Nominal, Degraded), `powertrain` configurations, `active_quirk` details (such as firmware calibration status), and current estimated `market_value`.
* **Feedstock & Hardware Components**: Represents raw materials and performance upgrade kits stored for fabrication or test sessions.
  * Attributes tracked include: category classification, physical quantities (tracked dynamically in units or sets), current quality/condition, and rule modifiers.
* **Integrated Rule Modifiers**: Just like the workshop's heavy machinery, components in your inventory can feature active `rule_modifier` blocks. When a component is in stock (quantity > 0), its modifiers automatically apply to the PbtA resolution rolls (e.g. Tier-1 ceramic brakes adding `+1` to `TECH` rolls during track performance testing).
* **Live Dashboard Visualization**: The Workshop Monitor features a dedicated, responsive inventory section presenting all vehicles and components in the form of visual status cards, condition indicators, quirk breakdowns, and formatted market values.
