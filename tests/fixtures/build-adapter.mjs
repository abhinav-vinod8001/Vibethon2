/** Exercise Next.js's adapter path without requiring a Vercel account or token. */
const adapter = {
  name: "JobSathi packaging regression",
  onBuildComplete() {
    console.log("Deployment adapter completed.");
  },
};

export default adapter;
