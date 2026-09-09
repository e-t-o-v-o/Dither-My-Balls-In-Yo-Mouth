import { echoTimes } from "./echo-sampler";
test("echo sampling is deterministic across frame rates and seeks", () => {
  expect(echoTimes(0.6, 3, 0.15)).toEqual([0.45, 0.3, 0.15]);
  expect(echoTimes(0.62, 3, 0.15)).toEqual([0.45, 0.3, 0.15]);
  expect(echoTimes(0, 4, 0.15)).toEqual([]);
  expect(echoTimes(0.1, 4, 0.1)).toEqual([0]);
});
