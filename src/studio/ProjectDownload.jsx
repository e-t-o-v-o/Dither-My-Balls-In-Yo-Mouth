import React, { useEffect, useState } from "react";

export function ProjectDownload({ project }) {
  const [url, setURL] = useState("");
  const json = JSON.stringify(project);
  useEffect(() => {
    const next = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    setURL(next);
    return () => URL.revokeObjectURL(next);
  }, [json]);
  return (
    <a
      className="button primary full"
      href={url || undefined}
      download={`${project.media.name.replace(/\.[^.]+$/, "")}.dither`}
    >
      Save project
    </a>
  );
}
