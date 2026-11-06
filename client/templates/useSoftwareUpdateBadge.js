import { useEffect } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { SoftwareUpdatesCollection, SoftwareUpdateReadsCollection } from "../../imports/api/links.js";

export const useSoftwareUpdateBadge = (userId, activeView) => {
  const { ready, unreadIds, pendingCount } = useTracker(() => {
    const updates = Meteor.subscribe("hlc-software-updates");
    const reads = Meteor.subscribe("hlc-software-update-reads");
    const seenIds = new Set(SoftwareUpdateReadsCollection.findOne(userId)?.seenIds || []);
    const entries = SoftwareUpdatesCollection.find({}, { fields: { _id: 1, approved: 1 } }).fetch();
    return {
      ready: updates.ready() && reads.ready(),
      // Drafts are published only to Admins and remain pending until approval.
      pendingCount: entries.filter((update) => update.approved !== true).length,
      unreadIds: entries.filter((update) => update.approved === true)
        .map((update) => update._id).filter((id) => !seenIds.has(id)).sort(),
    };
  }, [userId]);
  const unreadKey = JSON.stringify(unreadIds);

  useEffect(() => {
    if (!ready || activeView !== "updates") return;
    const ids = JSON.parse(unreadKey);
    if (!ids.length) return;
    Meteor.call("hlc.markSoftwareUpdatesSeen", ids, (error) => {
      if (error) console.error("Impossibile segnare gli aggiornamenti come visti.", error);
    });
  }, [ready, activeView, unreadKey, userId]);

  return ready ? unreadIds.length + pendingCount : 0;
};
