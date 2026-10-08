import Image from "next/image"

type BrandLogoProps = {
  placement?: "header" | "footer"
  showStudio?: boolean
}

/** Reuses the supplied Picshaw artwork without redrawing or recolouring it. */
export function BrandLogo({ placement = "header", showStudio = false }: BrandLogoProps) {
  const isFooter = placement === "footer"

  return (
    <>
      <span className={`shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 ${isFooter ? "h-14 w-14" : "h-10 w-10"}`}>
        <Image
          src="/brand/picshaw-mark.svg"
          alt=""
          width={56}
          height={56}
          className="h-full w-full"
        />
      </span>
      <span className={`font-bold uppercase tracking-[-0.04em] text-foreground ${isFooter ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"}`}>
        Picshaw
      </span>
      {showStudio && (
        <>
          <span aria-hidden="true" className="hidden h-5 w-px bg-border xl:block" />
          <span className="hidden text-[10px] uppercase tracking-[0.18em] text-muted-foreground xl:block">
            LA Web Studio
          </span>
        </>
      )}
    </>
  )
}
