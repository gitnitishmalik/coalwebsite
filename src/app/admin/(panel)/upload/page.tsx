import { AdminTitle } from "@/components/admin/page-title";
import { UploadAnalyzer } from "@/components/admin/upload-analyzer";
import { aiEnabled, MODELS } from "@/lib/ai";
import { getUploads } from "@/lib/store";

export const maxDuration = 300;

export default async function AdminUpload() {
  const uploads = await getUploads();
  return (
    <>
      <AdminTitle
        title="Upload & AI analysis"
        sub={`Upload files or paste data — AI extracts the prices, compares them with the live board and writes an overview and summary. Models: ${MODELS.vision.split("/")[1]} (reading) · ${MODELS.reasoning.split("/")[1]} (analysis).`}
      />
      <UploadAnalyzer history={uploads} aiOn={aiEnabled()} latest={null} />
    </>
  );
}
