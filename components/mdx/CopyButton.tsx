"use client";

import { Copy, CopyCheck } from "lucide-react";
import { useCallback, useState } from "react";

const CopyButton = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => setIsCopied(true));
    setTimeout(() => setIsCopied(false), 1000);
  }, [text]);

  return (
    <button className={className} onClick={copy}>
      {isCopied ? <CopyCheck /> : <Copy />}
    </button>
  );
};

export default CopyButton;
