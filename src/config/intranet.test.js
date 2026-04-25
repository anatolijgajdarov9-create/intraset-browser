import { isIntranetUrl } from './intranet';

describe('isIntranetUrl', () => {
  test('192.168.x.x является интранетом', () => {
    expect(isIntranetUrl('http://192.168.1.1')).toBe(true);
    expect(isIntranetUrl('http://192.168.0.100:3000')).toBe(true);
    expect(isIntranetUrl('http://192.168.10.50')).toBe(true);
  });

  test('10.x.x.x является интранетом', () => {
    expect(isIntranetUrl('http://10.0.0.1')).toBe(true);
    expect(isIntranetUrl('http://10.10.10.10')).toBe(true);
  });

  test('172.16-31.x.x является интранетом', () => {
    expect(isIntranetUrl('http://172.16.0.1')).toBe(true);
    expect(isIntranetUrl('http://172.31.255.255')).toBe(true);
  });

  test('localhost является интранетом', () => {
    expect(isIntranetUrl('http://localhost')).toBe(true);
    expect(isIntranetUrl('http://localhost:3000')).toBe(true);
    expect(isIntranetUrl('http://127.0.0.1')).toBe(true);
  });

  test('.local домен является интранетом', () => {
    expect(isIntranetUrl('http://server.local')).toBe(true);
    expect(isIntranetUrl('http://myapp.local')).toBe(true);
  });

  test('.intra домен является интранетом', () => {
    expect(isIntranetUrl('http://portal.intra')).toBe(true);
  });

  test('.corp домен является интранетом', () => {
    expect(isIntranetUrl('http://wiki.corp')).toBe(true);
  });

  test('пустой URL возвращает false', () => {
    expect(isIntranetUrl('')).toBe(false);
  });

  test('невалидный URL возвращает false', () => {
    expect(isIntranetUrl('not-a-url')).toBe(false);
  });

  test('обычный интернет-URL НЕ является интранетом', () => {
    expect(isIntranetUrl('https://google.com')).toBe(false);
    expect(isIntranetUrl('https://yandex.ru')).toBe(false);
    expect(isIntranetUrl('https://github.com')).toBe(false);
  });
});