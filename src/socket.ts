import { encode, decode } from './pack';
import { generateUUID } from './tools';
import type {
  PropsType,
  PropsFuncType,
  Communicate,
  ResType,
  CallbackStorage,
  SocketType,
  WithUrl,
} from './type';

const defaultProps: PropsFuncType = {
  onopen: () => {},
  onmessage: () => {},
  onclose: () => {},
  onerror: () => {},
};

/**
 * Socket
 * 基于WebSocket、msgpack、JSONRPC封装的实时通讯函数
 * @export
 * @class Socket
 */
export default class Socket {
  private props: PropsType;

  private guidStorage: Array<ResType['id']> = [];

  private callbackStorage: CallbackStorage = {};

  public ws: WebSocket;

  private streamID = '';

  constructor(props: PropsType) {
    this.props = { jsonrpc: '2.0', ...defaultProps, ...props };
    this.ws = this.setupWS();
  }

  /**
   * 初始化链接
   *
   * @private
   * @returns {WebSocket}
   * @memberof Socket
   */
  private setupWS(): WebSocket {
    const ws: WebSocket = new WebSocket(this.props.url, this.props.protocols);
    ws.binaryType = 'arraybuffer';
    ws.onopen = (e) => (<PropsFuncType['onopen']>this.props.onopen)(e);
    ws.onmessage = (e) => this.onmessage(e);
    ws.onclose = (e) => (<PropsFuncType['onopen']>this.props.onclose)(e);
    ws.onerror = (e) => (<PropsFuncType['onerror']>this.props.onerror)(e);
    return ws;
  }

  /**
   * 存储guid
   *
   * @private
   * @param {string} guid
   * @returns {string}
   * @memberof Socket
   */
  private saveGUID(guid: string): string {
    this.guidStorage.push(guid);
    return guid;
  }

  /**
   * 删除guid
   *
   * @private
   * @param {string} guid
   * @returns {boolean}
   * @memberof Socket
   */

  private deleteGUID(guid: string): boolean {
    const arr = this.guidStorage;
    const index = arr.indexOf(guid);
    if (index !== -1) {
      arr.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * send时触发超时函数
   *
   * @private
   * @param {string} guid
   * @memberof Socket
   */
  private touchTimeout(
    id: string,
    time: Communicate['timeout'] = 15 * 1000,
    onerror: Communicate['onerror'] = () => {}
  ): void {
    setTimeout(() => {
      if (this.guidStorage.includes(id)) {
        // 通知send超时
        onerror({
          code: 408,
          message: '发送数据链接超时',
        });
        // 清除guid
        this.deleteGUID(id);
      }
    }, time);
  }

  /**
   * 存储回调方法
   *
   * @private
   * @param {Communicate['callback']} callback
   * @param {string} id
   * @memberof Socket
   */
  private saveResponse(callback: Communicate['callback'], id: string) {
    this.callbackStorage[id] = callback;
  }

  /**
   * 执行回调方法并移除
   *
   * @private
   * @param {string} id
   * @returns
   * @memberof Socket
   */
  private finishResponse(res: ResType, id: string) {
    const callback = this.callbackStorage[id];
    if (this.callbackStorage[id] !== undefined && callback) {
      // 执行方法
      callback(res);
      // 移除方法的存储
      if (id !== this.streamID) delete this.callbackStorage[id];
    }
    return id;
  }

  /**
   * 接收数据
   *
   * @param {MessageEvent} buffer
   * @returns
   * @memberof Socket
   */
  private onmessage(e: MessageEvent) {
    const response: ResType = decode(
      Array.prototype.slice.call(new Uint8Array(e.data))
    );
    if (!response) return;
    const { id } = response;
    if (id && this.deleteGUID(id)) {
      this.finishResponse(response, id);
    }
    (<PropsFuncType['onmessage']>this.props.onmessage)(response);
  }

  /**
   * 发送数据
   *
   * @param {Communicate} params
   * @returns
   * @memberof Socket
   */
  public send: SocketType['send'] = (data: Communicate) => {
    const {
      id: paramId,
      method,
      isInform,
      callback,
      onerror,
      params,
      timeout,
    } = data;
    // 未建立链接不允许通信
    if (this.ws.readyState !== 1) {
      if (onerror) {
        onerror({
          code: 3,
          message: '连接已关闭或者没有链接成功',
        });
      }
      return;
    }
    // 未传method return
    if (method === undefined) return;
    // 如果是通知则无需存guid
    let guid: { id?: Communicate['id'] } = {};
    const id = this.saveGUID(paramId || generateUUID());
    if (!isInform) {
      guid = { id };
      // 如果需要回调处理
      if (callback) {
        this.saveResponse(callback, id);
      }
    }
    // 设置超时
    this.touchTimeout(id, timeout, onerror);

    // 构造完整send数据
    this.ws.send(
      encode({ jsonrpc: this.props.jsonrpc, params, method, ...guid })
    );
  };

  /**
   * 启用流模式
   *
   * @type {SocketType['stream']}
   * @memberof Socket
   */
  public stream: SocketType['stream'] = (data: Communicate) => {
    const { id: paramId, method, callback, params } = data;
    // 未传method || 未传回调 || 未建立链接 => 不允许通信
    if (method === undefined || !callback || this.ws.readyState !== 1) return;
    // 存储并维护id callback
    const id = this.saveGUID(paramId || generateUUID());
    if (callback) {
      this.saveResponse(callback, id);
    }
    // 构造完整send数据
    this.ws.send(
      encode({
        jsonrpc: this.props.jsonrpc,
        params,
        method,
        ...{ id: this.streamID },
      })
    );
    // 处理关闭逻辑：清除streamID 并关闭链接
    return {
      id: this.streamID,
      close: (code?: number, reason?: string) => {
        this.streamID = '';
        this.close(code, reason);
      },
    };
  };

  /**
   * 关闭链接
   *
   * @memberof Socket
   */
  public close: SocketType['close'] = (code, reason) =>
    this.ws.close(code, reason);

  /**
   * 更换url
   *
   * @type {WithUrl}
   * @memberof Socket
   */
  public withUrl: WithUrl = (url: string) => {
    // 关闭链接
    this.close();
    this.guidStorage = [];
    this.callbackStorage = {};
    this.streamID = '';
    // 载入新连接
    this.props.url = url;
    this.ws = this.setupWS();
  };
}
