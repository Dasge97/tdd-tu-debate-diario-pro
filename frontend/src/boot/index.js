import { bootAxios } from "@/boot/axios";

export function runBoot({ app, pinia, router }) {
  bootAxios({ app, pinia, router });
}
