"use client"

import { useState } from "react"
import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import type { Project } from "@/lib/work-showcase"
import styles from "./ProjectPreview.module.css"

/** A non-interactive editorial composition, not a screenshot of a client site. */
export function ProjectPreview({ project }: { project: Project }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)
  const { preview } = project

  return (
    <div
      role="img"
      aria-label={`${project.title} illustrative website concept. ${preview.headline.join(" ")} ${project.imageAlt}.`}
      className={`${styles.preview} ${styles[preview.theme]}`}
    >
      <div aria-hidden="true" className={styles.canvas}>
        <div className={styles.photo}>
          {!imageUnavailable && (
            <Image
              src={project.image}
              alt=""
              fill
              sizes="(max-width: 767px) 90vw, (max-width: 1023px) 80vw, 650px"
              className={styles.photoImage}
              style={{ objectPosition: project.imagePosition }}
              onError={() => setImageUnavailable(true)}
            />
          )}
        </div>
        <div className={styles.shade} />
        <div className={styles.navigation}>
          <div className={styles.identity}>
            <span className={styles.brand}>{preview.brand}</span>
            <span className={styles.strapline}>{preview.strapline}</span>
          </div>
          <div className={styles.links}>
            {preview.navigation.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className={styles.content}>
          <span className={styles.eyebrow}>{preview.eyebrow}</span>
          <div className={styles.headline}>
            <span>{preview.headline[0]}</span>
            <span>{preview.headline[1]}</span>
          </div>
          <p className={styles.description}>{preview.description}</p>
          <span className={styles.action}>
            {preview.action}<ArrowUpRight aria-hidden="true" />
          </span>
        </div>
        <div className={styles.bottomline}>
          <span>{preview.footer}</span>
          <span className={styles.conceptLabel}>DESIGN CONCEPT</span>
        </div>
      </div>
    </div>
  )
}
