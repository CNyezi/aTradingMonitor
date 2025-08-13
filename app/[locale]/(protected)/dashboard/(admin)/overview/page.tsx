import { GrowthChart } from "./GrowthChart";
import { OverviewStats } from "./OverviewStats";

const OverviewPage = () => {
  return (
    <div className="container mx-auto p-4 md:p-6">
      <OverviewStats />
      <div className="mt-6">
        <GrowthChart />
      </div>
    </div>
  );
};

export default OverviewPage;
