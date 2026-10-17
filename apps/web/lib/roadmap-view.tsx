import type { CSSProperties } from "react";

import {
  countsText,
  type IdeaGroup,
  ideaStages,
  ideaUrl,
  parseRoadmapTeam,
  type RoadmapIdea,
  type RoadmapSnapshot,
  type RoadmapTick,
  readDayText,
  roadmapLayout,
  sizeNames,
} from "./roadmap.ts";

/**
 * Streamlane's roadmap as /streamlane/roadmap/ shows it (CRV-015), drawn at build from what the build read
 * (lib/roadmap.ts) and shipping no client code: the committed ideas on a timeline by target period, each period's bar
 * placed across the months by CSS from its position; then the ideas not yet committed, by horizon or by stage. Each
 * idea links to its page in the product, the one link a visitor needs to add an insight. A read that failed shows no
 * idea, only that it could not be read, and where the team is.
 */

/** A custom property for the stylesheet, which places bars and month lines from it. */
const at = (props: Record<string, number>) =>
  Object.fromEntries(Object.entries(props).map(([name, value]) => [`--${name}`, value.toFixed(4)])) as CSSProperties;

const Idea = ({ idea, origin }: { idea: RoadmapIdea; origin: string }) => (
  <li className="roadmap-idea">
    <p className="roadmap-idea-key">{idea.key}</p>
    <h4 className="roadmap-idea-title">{idea.title}</h4>
    <p className="roadmap-idea-facts">
      {[ideaStages[idea.stage] ?? idea.stage, idea.size ? sizeNames[idea.size] : undefined].filter(Boolean).join(" · ")}
    </p>
    {idea.goal && (
      <p className="roadmap-idea-goal">
        <span className="roadmap-label">Goal</span> {idea.goal}
      </p>
    )}
    <p className="roadmap-idea-counts">{countsText(idea)}</p>
    <a className="roadmap-add" href={ideaUrl({ origin }, idea.key)} aria-label={`Add my insight: ${idea.title}`}>
      Add my insight
    </a>
  </li>
);

const Ideas = ({ ideas, origin }: { ideas: readonly RoadmapIdea[]; origin: string }) => (
  <ul className="roadmap-ideas">
    {ideas.map((idea) => (
      <Idea key={idea.key} idea={idea} origin={origin} />
    ))}
  </ul>
);

/**
 * A period's place across the months: decoration, since its heading names the period in words. Where the months are
 * many, a phone shows only every third label and each January's, so the labels never run into each other.
 */
const Track = ({ ticks, span }: { ticks: readonly RoadmapTick[]; span: { from: number; to: number } }) => (
  <div className="roadmap-track" aria-hidden="true">
    <div className="roadmap-lane">
      {ticks.map((tick) => (
        <span key={tick.at} className="roadmap-gridline" style={at({ at: tick.at })} />
      ))}
      <span className="roadmap-bar" style={at({ from: span.from, to: span.to })} />
    </div>
    <div className="roadmap-months">
      {ticks.map((tick, index) => (
        <span
          key={tick.at}
          className={
            ticks.length > 6 && index % 3 !== 0 && !tick.label.includes(" ")
              ? "roadmap-month roadmap-month-minor"
              : "roadmap-month"
          }
          style={at({ at: tick.at })}
        >
          {tick.label}
        </span>
      ))}
    </div>
  </div>
);

const Groups = ({ groups, origin }: { groups: readonly IdeaGroup[]; origin: string }) =>
  groups.map((group) => (
    <section key={group.name} className="roadmap-group">
      <h3 className="roadmap-group-name">{group.name}</h3>
      <Ideas ideas={group.ideas} origin={origin} />
    </section>
  ));

/** The page's word on a roadmap it has nothing to show of, and where the team is. */
const Notice = ({ snapshot, teamUrl }: { snapshot: RoadmapSnapshot; teamUrl: string }) => (
  <div className="roadmap roadmap-notice" role="status">
    <p className="roadmap-notice-text">
      {snapshot.state === "none"
        ? "This build of the site reads no roadmap, so no idea is shown here."
        : `Streamlane's roadmap could not be read when this page was built${
            snapshot.state === "unread" && snapshot.readAt ? `, on ${readDayText(snapshot.readAt)}` : ""
          }, so no idea is shown here.`}
    </p>
    <p className="roadmap-notice-text">
      It is public in Streamlane: <a href={teamUrl}>see Streamlane's planning team</a>.
    </p>
  </div>
);

export const StreamlaneRoadmap = ({ snapshot, team }: { snapshot: RoadmapSnapshot; team: string }) => {
  const named = parseRoadmapTeam(team);
  if (snapshot.state !== "read") return <Notice snapshot={snapshot} teamUrl={named.url} />;
  // The ideas link to the team they were read from.
  const read = parseRoadmapTeam(snapshot.team);
  const layout = roadmapLayout(snapshot.ideas, snapshot.threshold, snapshot.readAt);
  const committed = layout.timeline !== undefined || layout.undated.length > 0;
  const waiting = layout.waiting.groups.length > 0;
  return (
    <div className="roadmap">
      <p className="roadmap-asof">
        Read from <a href={read.url}>Streamlane's planning team</a> on {readDayText(snapshot.readAt)}.
      </p>
      {!committed && !waiting && <p className="roadmap-empty">Nothing is on Streamlane's roadmap yet.</p>}
      {committed && (
        <section className="roadmap-section" aria-labelledby="committed">
          <h2 id="committed">Committed</h2>
          <p className="roadmap-intro">
            {layout.timeline
              ? "What the team has committed to build, by the period it is planned for, earliest first."
              : "What the team has committed to build. None has a target period yet."}
          </p>
          {layout.timeline && (
            <ol className="roadmap-periods">
              {layout.timeline.periods.map((period) => (
                <li key={period.name} className="roadmap-period">
                  <h3 className="roadmap-period-name">{period.name}</h3>
                  <Track ticks={layout.timeline?.ticks ?? []} span={period.span} />
                  <Ideas ideas={period.ideas} origin={read.origin} />
                </li>
              ))}
            </ol>
          )}
          {layout.timeline && layout.undated.length > 0 && (
            <Groups groups={[{ name: "No target period yet", ideas: layout.undated }]} origin={read.origin} />
          )}
          {!layout.timeline && <Ideas ideas={layout.undated} origin={read.origin} />}
        </section>
      )}
      {waiting && (
        <section className="roadmap-section" aria-labelledby="waiting">
          <h2 id="waiting">Not yet committed</h2>
          <p className="roadmap-intro">
            {layout.waiting.by === "horizon"
              ? "The ideas the team is weighing, by when it means to get to them."
              : "The ideas the team is weighing, by stage, nearest to committed first."}
          </p>
          <Groups groups={layout.waiting.groups} origin={read.origin} />
        </section>
      )}
    </div>
  );
};
