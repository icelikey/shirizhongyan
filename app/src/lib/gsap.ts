/**
 * GSAP 统一入口 —— 每模块注册一次所需插件（react-dev.md）。
 * 滚动叙事组件从这里导入，避免重复注册。
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }
